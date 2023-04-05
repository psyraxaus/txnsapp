const { ipcRenderer, shell } = require('electron');
const remote = require("@electron/remote");
const { Menu, MenuItem } = remote;
const path = require('path');
const mainProcess = remote.require('./main');
const currentWindow = require('@electron/remote').getCurrentWindow();
const { BrowserWindow } = require('@electron/remote');
const { DateTime } = require("luxon");

const addrListNode = document.getElementById("addrList");
const txListNode = document.getElementById("txList");
const transactionView = document.querySelector('.transactions-text');
const currentTaskwindowText = document.getElementById('currenttaskwindowtext');
const addAddressesButton = document.querySelector('#add-addresses-button');
const fetchAllTransactionsButton = document.querySelector('#fetch-all-txns');
const fetchSingleAddressTransactionsButton = document.querySelector('#fetch-single-txns-button');
const removeAllTransactionsButton = document.querySelector('#remove-all-txns');
const exportAllTransactionsButton = document.querySelector('#export-alll-txns');
const settingsButton = document.querySelector('#settings-button');
const removeAddresButton = document.querySelector('#remove-address-button');
const editAddresButton = document.querySelector('#edit-address-button');
const exportSingleAddressButton = document.querySelector('#export-single-addr-txns-button');
const progressBar = document.getElementById('bar');
const searchTextBox = document.getElementById('searchBox');
//const searchType = document.querySelector('input[name="searchType"]:checked');
const clearButton = document.querySelector('#clear-button');

let filePath = null;
let settings;
let selectedAddress;
let searchText = '';

const eventHandler = (event) => {
  let searchType = document.querySelector('input[name="searchType"]:checked').value

  if ( event.key == 'Backspace') {
    searchText = document.getElementById('searchBox').value
  } else if ( event.key == 'Delete' ) {
    searchText = document.getElementById('searchBox').value
  } else if ( event.key ) {
    searchText = document.getElementById('searchBox').value
  }

  mainProcess.getAddressList(currentWindow, searchType, searchText);
}

if (document.querySelector('input[name="searchType"]')) {
  document.querySelectorAll('input[name="searchType"]').forEach((elem) => {
    elem.addEventListener("change", function(event) {
      eventHandler(event);
      var item = event.target.value;
      console.log(item);
    });
  });
}

searchTextBox.addEventListener('keyup', eventHandler, false);
searchTextBox.addEventListener('click', eventHandler, false);

clearButton.addEventListener('click', () => {
  event.preventDefault();
  document.getElementById('searchBox').value = "";
  searchText = '';
  mainProcess.getAddressList(currentWindow);
})

/*
searchTextBox.addEventListener('keyup', (event) => {
    if (event.key == 'Backspace') {
        console.log('Backspace pressed')
        if ( searchText != '' ) {
            console.log('Caret at: ', event.target.selectionStart)
        }
    } 
    searchText = searchText + event.key;
    console.log(searchText)
})

searchTextBox.addEventListener('click', (event) => {
    event.preventDefault();
    console.log(event.target.selectionStart)

})
*/
addrListNode.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  var clicked = event.target;
  let addrStr = clicked.parentNode.id;
  if (!addrStr) {
    addrStr = clicked.parentNode.parentNode.id;
    if (!addrStr) {
      addrStr = clicked.parentNode.parentNode.parentNode.id;
    }
  } else if (addrStr === 'addrList') {
    addrStr = clicked.id
  }
  const menu = new Menu();
  menu.append(new MenuItem(
    { label: 'View Address on Explorer', click() {
      shell.openExternal(`${settings.explorerUrl}/address/${addrStr}`)
    } }
  ));
  menu.popup({ window: remote.getCurrentWindow() })
});

txListNode.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  var clicked = event.target;
  let txidStr = clicked.dataset.txid;
  if (!txidStr) {
    txidStr = clicked.parentNode.dataset.txid;
    if (!txidStr) {
      txidStr = clicked.parentNode.parentNode.dataset.txid;
    }
  }

  const menu = new Menu();
  menu.append(new MenuItem(
    { label: 'View Transaction on Explorer', click() {
      shell.openExternal(`${settings.explorerUrl}/tx/${txidStr}`)
    } }
  ));
  menu.popup({ window: remote.getCurrentWindow() })
})

fetchAllTransactionsButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.fetchAllTransactions(currentWindow);
})

fetchSingleAddressTransactionsButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.fetchSingleAddressTransactions(currentWindow, selectedAddress);
})

exportSingleAddressButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.exportSingleAddressTransactions(currentWindow, selectedAddress, settings.csvFormat);
})

exportAllTransactionsButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.saveExportedTransactions(currentWindow, settings.csvFormat);
})

removeAllTransactionsButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.removeAllTransactions(currentWindow);
})

removeAddresButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.removeSingleAddress(currentWindow, selectedAddress)
})

editAddresButton.addEventListener('click', () => {
  event.preventDefault();
  editAddresButton.disabled = true;
  let originalSourceText;
  let originalDescriptionText;
  let sourceBox = document.createElement("input");
  let descriptionBox = document.createElement("input");
  let saveButton = document.createElement("button");
  saveButton.innerHTML = "Save";
  saveButton.className = "saveButton";
  let cancelButton = document.createElement("button");
  cancelButton.innerHTML = "Cancel";
  cancelButton.className = "cancelButton";
  const addrItemToEdit = document.getElementById(`${selectedAddress}`)
  let buttonCheck = addrItemToEdit.getElementsByClassName('saveButton');
  if (!addrItemToEdit.querySelector('.saveButton')) {
    addrItemToEdit.appendChild(saveButton);
    addrItemToEdit.appendChild(cancelButton);
    originalSourceText = addrItemToEdit.querySelector('.addrNameText');
    originalDescriptionText = addrItemToEdit.querySelector('.addrDescriptionText');
    addrItemToEdit.querySelector('.addrNameText').replaceWith(sourceBox);
    addrItemToEdit.querySelector('.addrDescriptionText').replaceWith(descriptionBox);
  };

  cancelButton.addEventListener('click', () => {
    addrItemToEdit.removeChild(saveButton);
    addrItemToEdit.removeChild(cancelButton);
    addrItemToEdit.querySelector('.addrName').removeChild(sourceBox);
    addrItemToEdit.querySelector('.addrDescription').removeChild(descriptionBox);
    addrItemToEdit.querySelector('.addrName').appendChild(originalSourceText);
    addrItemToEdit.querySelector('.addrDescription').appendChild(originalDescriptionText);
  });
  saveButton.addEventListener('click', () => {
    mainProcess.updateAddressDetails(currentWindow, selectedAddress, sourceBox.value, descriptionBox.value);
    addrItemToEdit.querySelector('.addrName').removeChild(sourceBox);
    addrItemToEdit.querySelector('.addrDescription').removeChild(descriptionBox);
    addrItemToEdit.removeChild(saveButton);
    addrItemToEdit.removeChild(cancelButton);
    ipcRenderer.on('address-updated', (event, message) => {
      addrItemToEdit.querySelector('.addrName').appendChild(originalSourceText);
      addrItemToEdit.querySelector('.addrNameText').innerHTML = message[0].walletsource;
      addrItemToEdit.querySelector('.addrDescription').appendChild(originalDescriptionText);
      addrItemToEdit.querySelector('.addrDescriptionText').innerHTML = message[0].description;
    })
  });
});

addAddressesButton.addEventListener('click', () => {
  let win = new BrowserWindow( {
    width: 1135,
    height: 290,
    show: true,
    parent: currentWindow,
    frame: false,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webSecurity: false
    }, show: false
  });

  win.setResizable(false);
  remote.require("@electron/remote/main").enable(win.webContents);

  win.webContents.on('did-finish-load', () => {
  });


  win.on('close', () => {
    win = null;
  });

  win.loadURL(`file://${__dirname}/../html/addAddress.html`);
  win.show();
});

settingsButton.addEventListener('click', () => {
  let win = new BrowserWindow( {
    width: 645,
    height: 325,
    show: true,
    parent: currentWindow,
    frame: false,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webSecurity: false
    }
  });

//  win.setResizable(true);
  remote.require("@electron/remote/main").enable(win.webContents);
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('settingsRunning', settings)
  });


  win.on('close', () => {
    win = null;
  });

  win.loadURL(`file://${__dirname}/../html/settings.html`);
  win.show();
});

ipcRenderer.on('ready', async(event) => {
  mainProcess.loadSettings(currentWindow);
});

ipcRenderer.on('new-addresses', (event, newAddressItems) => {
  for (let i = 0; i < newAddressItems.length; i++) {
    const addrItem = formatAddrItem(newAddressItems[i]);
    addrListNode.appendChild(addrItem);
  }
  _highlightAddr();
});

ipcRenderer.on('task-running', (event, message) => {
  if (message.includes("Error")) {
    document.getElementById('currenttaskwindowtext').style.color = '#DC143C';
    currentTaskwindowText.innerHTML = message;
  } else {
    document.getElementById('currenttaskwindowtext').style.color = 'black'
    currentTaskwindowText.innerHTML = message;
  };
});

ipcRenderer.on('progress-bar', (event, percentage) => {
  _setBar(percentage);
})

ipcRenderer.on('settings', (event, message) => {
  settings = message;
  mainProcess.saveSettings(currentWindow);
  currentTaskwindowText.innerHTML = `Current API URL: ${settings.apiUrl}`;
});

ipcRenderer.on('transactions-deleted', (event) => {
  removeAllTransactionsButton.disabled = true;
  exportAllTransactionsButton.disabled = true;
  fetchSingleAddressTransactionsButton.disabled = true;
  exportSingleAddressButton.disabled = true;
});

ipcRenderer.on('has-transactions', (event) => {
  removeAllTransactionsButton.disabled = false;
  exportAllTransactionsButton.disabled = false;
  exportSingleAddressButton.disabled = false;
});

ipcRenderer.on('addresses-loaded', (event, addressItems) => {
  _removeAllChildNodes(addrListNode);
  _removeAllChildNodes(txListNode);

  for (let i = 0; i < addressItems.length; i++) {
    const addrItem = formatAddrItem(addressItems[i]);
    addrListNode.appendChild(addrItem);
  }
  _highlightAddr();
})

ipcRenderer.on('address-transactions', (event, transactionItems) => {
  txListNode.innerHTML = '';
  for (let i = 0; i < transactionItems.length; i++) {
    const txItem = createTxItem(transactionItems[i]);
    txListNode.appendChild(txItem);
  }
});

const formatAddrItem = (addrObj) => {
    const addrItem = cloneTemplate("addrItemTemplate");
    addrItem.dataset.addr = addrObj.address;
    addrItem.id = addrObj.address;

    setAddressNodeName(addrObj, addrItem.getElementsByClassName("addrNameText")[0]);
    addrItem.querySelector(".addrDescriptionText").textContent = `${addrObj.description}`;
    addrItem.getElementsByClassName("addrText")[0].textContent = formatAddressInList(addrObj.address);
    addrItem.addEventListener("click", () => {
      const addrAttr = addrItem.getAttribute('data-addr');
      mainProcess.getTransactionsByAddress(currentWindow, addrObj.address);
      selectedAddress = addrObj.address;
      removeAddresButton.disabled = false;
    });
    return addrItem;
};

const createTxItem = (txObj, newTx = false) => {
    const node = cloneTemplate("txItemTemplate");
    node.dataset.txid = txObj.txid;
    node.dataset.blockheight = txObj.block;
    node.querySelector(".txId").textContent = txObj.txid;
    if (txObj.block >= 0) {
        node.querySelector(".txDate").textContent = formatEpochTime(txObj.time * 1000);
    }
    setTxBalanceText(node.querySelector(".txBalance"), txObj.amount);
    if (newTx) {
        node.classList.add("txItemNew");
    }
    return node;
};

const showTxDetail = (txObj) => {
    const templateId = "txDialogTemplate";
    showDialogFromTemplate(templateId, dialog => {
        dialog.querySelector(".txDetailTxId").textContent = txObj.txid;
        dialog.querySelector(".txInfoLink").addEventListener("click", () => openZenExplorer("tx/" + txObj.txid));
        setTxBalanceText(dialog.querySelector(".txDetailAmount"), txObj.amount);
        const vinListNode = dialog.querySelector(".txDetailFrom");
        txObj.vins.split(",").sort().forEach(addr => {
            const node = document.createElement("div");
            node.textContent = addr;
            if (addrIdxByAddr.has(addr)) {
                node.classList.add("negative");
            }
            vinListNode.append(node);
        });
        const voutListNode = dialog.querySelector(".txDetailTo");
        txObj.vouts.split(",").sort().forEach(addr => {
            const node = document.createElement("div");
            node.textContent = addr;
            if (addrIdxByAddr.has(addr)) {
                node.classList.add("positive");
            }
            voutListNode.append(node);
        });
        if (txObj.block >= 0) {
            dialog.querySelector(".txDetailDate").textContent = formatEpochTime(txObj.time * 1000);
            dialog.querySelector(".txDetailBlock").textContent = txObj.block;
        }
    });
};

const cloneTemplate = (id) => {
    const templateNode = document.getElementById(id);
    if (!templateNode) {
        throw new Error(`No template with ID "${id}"`);
    }
    const node = templateNode.content.cloneNode(true).firstElementChild;
    if (!node) {
        throw new Error(`Template is empty (ID "${id}")`);
    }
    fixPage(node);
    return node;
};

const fixPage = (parent = document) => {
    fixLinks(parent);
};

const fixLinks = (parent = document) => {
    querySelectorAllDeep("a[href^='http']", parent).forEach(link => link.addEventListener("click", linkHandler));
};

const setAddressNodeName = (addrObj, addrNode) => {
    if (addrObj.walletsource) {
        setNodeTrText(addrNode, addrObj.address, null, `${addrObj.walletsource}`);
    } else {
        setNodeTrText(addrNode, addrObj.address, "wallet.tabOverview.unnamedAddress", "Unnamed address");
    }
};

const formatAddressInList = (addr) => {
    if (addr.length === 35) {
        return addr;
    } else {
        return addr.substring(0, 17) + "..." + addr.substring(80);
    }
};

function querySelectorAllDeep(selector, startRoot = document) {
    const roots = [startRoot];
    const nodeQueue = [...startRoot.children];

    while (nodeQueue.length) {
        const node = nodeQueue.shift();
        if (node.shadowRoot) {
            roots.push(node.shadowRoot);
        }
        if (node.tagName === "TEMPLATE" && node.content) {
            roots.push(node.content);
        }
        nodeQueue.push(...node.children);
    }

    const matches = [];
    for (const r of roots) {
        matches.push(... r.querySelectorAll(selector));
    }
    return matches;
};

function deepClone(obj) {
    // feel free to make a better implementation
    if (!obj) {
        return null;
    }
    return JSON.parse(JSON.stringify(obj));
};

function setNodeTrText(node, address, key, defaultVal) {
    if (key) {
        node.dataset.tr = key;
        node.id = address;
        node.textContent = tr(key, defaultVal);
    } else {
        delete node.dataset.tr;
        node.textContent = defaultVal;
    }
};

function tr(key, defaultVal) {
    return (settings && settings.lang) ? translate(langDict, key, defaultVal) : defaultVal;
};

function formatEpochTime(epochSeconds) {
    return DateTime.fromMillis(epochSeconds).toLocaleString(DateTime.DATETIME_MED);
};

function setTxBalanceText(node, balance) {
    let balanceStr, balanceClass;
    if (balance >= 0) {
        balanceStr = "+" + formatBalance(balance);
        balanceClass = "positive";
    } else {
        balanceStr = "-" + formatBalance(-balance);
        balanceClass = "negative";
    }
    node.classList.add(balanceClass);
    const amountNode = node.firstElementChild;
    amountNode.textContent = balanceStr;
};

function formatBalance(balance, localeTag = undefined) {
    return parseFloat(balance).toLocaleString(localeTag, {minimumFractionDigits: 8, maximumFractionDigits: 8});
};

const _highlightAddr = () => {
  document.querySelectorAll('.addrItem').forEach(function (el) {
    el.addEventListener('click', function (e) {
      document.querySelectorAll('.addrItem').forEach(x => x.classList.remove('active'));
      e.currentTarget.classList.toggle('active');
      editAddresButton.disabled = false;
      fetchSingleAddressTransactionsButton.disabled = false;
    });
  });
};

const _removeAllChildNodes = (parent) => {
    while (parent.firstChild) {
        parent.removeChild(parent.firstChild);
    }
};

const _setBar = (percentage) => {
  progressBar.style.width = percentage + "%";
};
