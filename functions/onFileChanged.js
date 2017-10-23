"use strict";

var _interopRequireDefault = require("babel-runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _promise = _interopRequireDefault(require("babel-runtime/core-js/promise"));

var _child_process = _interopRequireDefault(require("child_process"));

const exec = _child_process.default.exec;

function logResult(error, stdout, stderr) {
  if (error !== null) {
    console.error(`exec error: ${error}`);
    return;
  }

  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }

  console.log(stdout);
}

function onFileChanged(client, thisSubscription, globalContext) {
  const serviceContext = thisSubscription.serviceContext;
  const functionSettings = serviceContext.functions;
  const yarnOrNpmRun = globalContext.yarn ? 'yarn' : 'npm run';
  const yarnOrNpm = globalContext.yarn ? 'yarn' : 'npm';
  const packagePromise = new _promise.default((resolve, reject) => {
    console.log('#### package promise starting');
    const packageCommand = `${yarnOrNpmRun} package-functions-${globalContext.env}`;
    const installCommand = `cd functions && ${yarnOrNpm} install`;
    const command = `cd ${serviceContext.directory} && cd ../ && ${packageCommand} && ${installCommand}`;
    console.log(`#### ${command}`);
    exec(command, (error, stdout, stderr) => {
      console.log('#### exec done');
      logResult(error, stdout, stderr);

      if (error || stderr) {
        // ignore incorrect peer dependency errors
        if (stderr.indexOf('incorrect peer dependency') >= 0 || stderr.indexOf('warning') >= 0) {
          resolve();
          return;
        }

        reject();
        return;
      }

      resolve();
    });
  });
  const topicOrHttp = functionSettings.topic ? `--trigger-topic ${functionSettings.topic}` : '--trigger-http';
  packagePromise.then(() => {
    console.log('#### package promise done');

    if (functionSettings.deploy !== undefined && !functionSettings.deploy.auto) {
      console.log('#### auto deploy off, skipping');
      return;
    }

    const deployCommand = `${functionSettings.name} ${topicOrHttp} --entry-point ${functionSettings.entryPoint} -l=${thisSubscription.watchWithFolder.replace('functionsES6', '')}/functions`; // eslint-disable-line

    console.log(deployCommand);
    exec(`functions-emulator deploy ${deployCommand}`, (error, stdout, stderr) => {
      logResult(error, stdout, stderr);
    });
  }).finally(() => {
    console.log('##### leaving', thisSubscription.watchWithFolder, thisSubscription.stateName);
    client.command(['state-leave', thisSubscription.watchWithFolder, thisSubscription.stateName], (error, resp2) => {
      if (error) {
        console.error(error);
      }

      console.log('#### state leave', resp2.root);
    });
  });
}

var _default = onFileChanged;
exports.default = _default;
module.exports = exports["default"];