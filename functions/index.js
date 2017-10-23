"use strict";

var _interopRequireDefault = require("babel-runtime/helpers/interopRequireDefault");

var _keys = _interopRequireDefault(require("babel-runtime/core-js/object/keys"));

var _fbWatchman = _interopRequireDefault(require("fb-watchman"));

var _path = _interopRequireDefault(require("path"));

var _jsYaml = _interopRequireDefault(require("js-yaml"));

var _fs = _interopRequireDefault(require("fs"));

var _onFileChanged = _interopRequireDefault(require("./onFileChanged"));

const client = new _fbWatchman.default.Client();
let config = null;

const configPath = _path.default.join(process.cwd(), './functions-compose.yml');

const ourSubsciptions = {};

try {
  config = _jsYaml.default.safeLoad(_fs.default.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error(e);
}

client.capabilityCheck({
  optional: [],
  required: ['relative_root']
}, error => {
  if (error) {
    console.error(error);
    client.end();
    return;
  } // clear past watches
  // client.command(['watch-del-all']);


  const globalContext = {
    yarn: config.yarn,
    env: config.env
  };
  (0, _keys.default)(config.services).forEach(key => {
    const serviceContext = config.services[key]; // Initiate the watch

    client.command(['watch-project', `${process.cwd()}/${serviceContext.directory}`], (watchError, resp) => {
      if (watchError) {
        console.error('Error initiating watch:', watchError);
        return;
      }

      if ('warning' in resp) {
        console.log('warning: ', resp.warning);
      }

      console.log(`watch established on ${resp.watch} relative_path ${resp.relative_path}`);
    });
    const subscriptionName = `${serviceContext.functions.name}-subscription`;
    const stateName = `${serviceContext.functions.name}-state`;
    const sub = {
      // Match any `.js` file in the dir_of_interest
      expression: ['allof', ['type', 'f'], ['suffix', 'js']],
      // Which fields we're interested in
      fields: ['name', 'size', 'exists', 'mtime_ms', 'type'],
      defer: [stateName]
    };
    const watchWithFolder = `${process.cwd()}/${serviceContext.directory}`; // functionsES6

    client.command(['subscribe', watchWithFolder, subscriptionName, sub], (subscribeError, resp) => {
      if (error) {
        // Probably an error in the subscription criteria
        console.error('failed to subscribe: ', subscribeError);
        return;
      }

      console.log(`subscription ${resp.subscribe} established`);
      ourSubsciptions[subscriptionName] = {
        watchWithFolder,
        serviceContext,
        subscriptionName,
        stateName
      };
    });
  });
  client.on('subscription', resp => {
    console.log('#### subscription response', resp.subscription);
    const thisSubscription = ourSubsciptions[resp.subscription];

    if (resp['state-leave']) {
      console.log('### bailing state-leave');
      return;
    }

    if (resp['state-enter']) {
      console.log('#### resp state-enter');
      (0, _onFileChanged.default)(client, thisSubscription, globalContext);
      return;
    }

    resp.files.forEach(file => {
      console.log(`#### file changed: ${file.name}`);
    }); // we didn't just leave state
    // and we dind't just enter state
    // so let's enter state! (like a highway...)

    client.command(['state-enter', thisSubscription.watchWithFolder, thisSubscription.stateName], (stateEnterError, resp2) => {
      if (stateEnterError) {
        console.error(stateEnterError);
      }

      console.log('#### state leave', resp2.root);
    });
  });
});