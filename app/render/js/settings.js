const { dialog } = require('electron');
const ipc = require('electron').ipcRenderer;
const currentWindow = require('@electron/remote').getCurrentWindow();
const remote = require("@electron/remote");
const mainProcess = remote.require('./main.js');
const sqlite3 = require('sqlite3');

let settings;
const statusText = document.getElementById('settingsStatus');
const explorerUrlTextBox = document.getElementById('explorerUrlTextBox');
const apiUrlTextBox = document.getElementById('apiUrlTextBox');
const refreshTextBox = document.getElementById('refreshTextBox');
const coinTrackingRad = document.getElementById('Cointracking');
const cryptotaxcalcRad = document.getElementById('CrytotaxCalc');
const accointingRad = document.getElementById('Accointing');
const koinlyRad = document.getElementById('Koinly');
const unformattedRad = document.getElementById('Unformatted');
const closeButton = document.getElementById('closebutton');
const saveSettingsButton = document.getElementById('savesettingsbutton');
const consolidateNodeTxnsBox = document.getElementById('consolidate');

ipc.on('settingsRunning', (event, message) => {
  settings = message;
  explorerUrlTextBox.value = settings.explorerUrl;
  apiUrlTextBox.value = settings.apiUrl;
  refreshTextBox.value = settings.refreshIntervalAPI;
  consolidateNodeTxnsBox.checked = settings.consolidateNodeTxns;
  switch (settings.csvFormat) {
    case 'Unformatted':
      unformattedRad.checked = true;
      break;
    case 'Koinly':
      koinlyRad.checked = true;
      break;
    case 'Cointracking':
      coinTrackingRad.checked = true;
      break;
    case 'CrytotaxCalc':
      cryptotaxcalcRad.checked = true;
      break;
    case 'Accointing':
      accointingRad.checked = true;
      break;
  }
});

closeButton.addEventListener('click', (event) => {
  window.close();
});

saveSettingsButton.addEventListener('click', (event) => {
  event.preventDefault();
  let csvType = document.querySelector('input[name="csvType"]:checked').value;
  let consolidate = document.querySelector('#consolidate');
  let updatedSettings = {
    explorerUrl: explorerUrlTextBox.value,
    apiUrl: apiUrlTextBox.value,
    csvFormat: csvType,
    refreshIntervalAPI: parseInt(refreshTextBox.value),
    consolidateNodeTxns: consolidate.checked
  };
  mainProcess.setSettings(currentWindow, updatedSettings);
  window.close();
});
