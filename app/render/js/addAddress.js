const { dialog } = require('electron');
const ipc = require('electron').ipcRenderer;
const currentWindow = require('@electron/remote').getCurrentWindow();
const remote = require("@electron/remote");
const mainProcess = remote.require('./main.js');
const bitcore = require('bitcore-lib-zen');


ipc.on('message', (event, message) => console.log(message));

const addAddressButton = document.getElementById('add-address-button');
const addressTextBox = document.getElementById('addresstextbox');
const derivationText = document.getElementById('derivationPathText');
const descriptionTextBox = document.getElementById('descriptiontextbox');
const walletSourceTextBox = document.getElementById('walletsourcetextbox');
const singleAddressRad = document.querySelector('#single');
const xpubRad = document.querySelector('#xpub');
const fileRad = document.querySelector('#file');
const closeButton = document.getElementById('closebutton');
const openFileButton = document.getElementById('add-file');

let addAddressType = 'single';

addressTextBox.addEventListener('keyup', (event) => {
  const currentContent = event.target.value;
  console.log(currentContent)
  if (currentContent.length === "") {
    addAddressButton.disabled = true;
  } else {
    addAddressButton.disabled = false;
  }
});

const updateUserInterface = (isEdited, addrType) => {
  let title = 'Add Address Dialog';
  if (isEdited) { title = `${title} (Edited)`; }

  currentWindow.setTitle(title);
  currentWindow.setDocumentEdited(isEdited);

  if (addrType !== 'file') {
    openFileButton.disabled = true;
  }
  if (addrType === 'single') {
  } else if (addrType === 'xpub') {
  } else if (addrType === 'file') {
    openFileButton.disabled = !isEdited;
  };
};

addAddressButton.addEventListener('click', event => {
  event.preventDefault();
  let addressText = document.getElementById('addresstextbox').value;
  let descriptionText = document.getElementById('descriptiontextbox').value;
  let walletSourceText = document.getElementById('walletsourcetextbox').value;

  if (addAddressType === 'single') {
    mainProcess.addSingleAddress(currentWindow, addressText.trim(), walletSourceText,  descriptionText);
  } else if (addAddressType === 'xpub') {
    addAddressButton.disabled = true;
    closeButton.disabled = true;
    mainProcess.deriveAddressesFromXpub(currentWindow, addressText.trim(), walletSourceText,  descriptionText);
  } else if (addAddressType === 'file') {
    addAddressButton.disabled = true;
    closeButton.disabled = true;
    mainProcess.loadAddressesFromFile(currentWindow, addressText.trim(), descriptionText);
  };
  addresstextbox.value = '';
  addAddressButton.disabled = true;
});

closeButton.addEventListener('click', (event) => {
  window.close();
});

singleAddressRad.addEventListener('click', (event) => {
  addAddressType = 'single';
  updateUserInterface(true, addAddressType);
});

fileRad.addEventListener('click', (event) => {
  addAddressType = 'file';
  updateUserInterface(true, addAddressType);
});

xpubRad.addEventListener('click', (event) => {
  addAddressType = 'xpub';
  updateUserInterface(true, addAddressType);
});

openFileButton.addEventListener('click', () => {
  event.preventDefault()
  const fileName = mainProcess.getFileFromUser(currentWindow);
  addAddressButton.disabled = false;
  console.log(fileName);
});

ipc.on('file-opened', (event, file) => {
  addAddressType = 'file';
  addressTextBox.value = file;
  //updateUserInterface(true, addAddressType, content);
});

ipc.on('searchDerivationPath', (event, message) => {
  if (message.includes("Error")) {
    console.log('error found')
    document.getElementById('derivationPathText').style.color = '#DC143C';
    derivationText.innerHTML = message;
  }
  derivationText.innerHTML = message;
});

ipc.on('completed-import', (event) => {
  closeButton.disabled = false;
})
