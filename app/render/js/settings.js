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
const consolidateNodeTxnsBox = document.getElementById('consol-Node-Transactions');
const consolidateInternalVinsTxnsBox = document.getElementById('consol-Internal-Transactions');
const tagTxAsFaucetBox = document.getElementById('tag-Tx-As-Faucet');
const tagTxAsRewardBox = document.getElementById('tag-Tx-As-Reward');

ipc.on('settingsRunning', (event, message) => {
  settings = message;
  explorerUrlTextBox.value = settings.explorerUrl;
  apiUrlTextBox.value = settings.apiUrl;
  refreshTextBox.value = settings.refreshIntervalAPI;
  consolidateNodeTxnsBox.checked = settings.consolidateNodeTxnsCheck;
  consolidateInternalVinsTxnsBox.checked = settings.consolidateVinsTxnsCheck;
  tagTxAsFaucetBox.checked = settings.tagTxAsFaucet;
  tagTxAsRewardBox.checked = settings.tagTxAsReward;
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
  let consolidateNodeTransactions = document.querySelector('#consol-Node-Transactions');
  let consolidateInternalVinsTransactions = document.querySelector('#consol-Internal-Transactions');
  let tagTxAsFaucet = document.querySelector('#tag-Tx-As-Faucet');
  let tagTxAsReward = document.querySelector('#tag-Tx-As-Reward');
  let updatedSettings = {
    explorerUrl: explorerUrlTextBox.value,
    apiUrl: apiUrlTextBox.value,
    csvFormat: csvType,
    refreshIntervalAPI: parseInt(refreshTextBox.value),
    consolidateNodeTxnsCheck: consolidateNodeTransactions.checked,
    consolidateVinsTxnsCheck: consolidateInternalVinsTransactions.checked,
    tagTxAsFaucet: tagTxAsFaucet.checked,
    tagTxAsReward: tagTxAsReward.checked
  };
  mainProcess.setSettings(currentWindow, updatedSettings);
  window.close();
});
