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
const removeAllTransactionsButton = document.querySelector('#remove-all-txns');
const exportAllTransactionsButton = document.querySelector('#export-alll-txns');
const settingsButton = document.querySelector('#settings-button');
const removeAddresButton = document.querySelector('#remove-address-button');
const divs = addrListNode.querySelectorAll('.addrItem');

let filePath = null;
let settings;
let selectedAddress;

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

  console.log(txidStr)
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

exportAllTransactionsButton.addEventListener('click', () => {
  event.preventDefault();
  mainProcess.saveExportedTransactions(currentWindow, settings.csvFormat);
})

removeAddresButton.addEventListener('click', () => {
  event.preventDefault();
  console.log(selectedAddress)
})

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
    height: 225,
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
  }
  currentTaskwindowText.innerHTML = message;
});

ipcRenderer.on('settings', (event, message) => {
  settings = message;
  mainProcess.saveSettings(currentWindow);
  currentTaskwindowText.innerHTML = `Current API URL: ${settings.apiUrl}`;
});

ipcRenderer.on('file-save', (event, filePath) => {
})

ipcRenderer.on('addresses-loaded', (event, addressItems) => {
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

    setAddressNodeName(addrObj, addrItem.getElementsByClassName("addrName")[0]);
    addrItem.getElementsByClassName("addrText")[0].textContent = formatAddressInList(addrObj.address);
    addrItem.addEventListener("click", () => {
      const addrAttr = addrItem.getAttribute('data-addr');
      mainProcess.getTransactionsByAddress(currentWindow, addrObj.address);
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
//    node.addEventListener("click", () => showTxDetail(txObj));
    return node;
}

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
}

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
}

const setAddressNodeName = (addrObj, addrNode) => {
    if (addrObj.walletsource) {
        setNodeTrText(addrNode, addrObj.address, null, `Source: ${addrObj.walletsource}`);
    } else {
        setNodeTrText(addrNode, addrObj.address, "wallet.tabOverview.unnamedAddress", "Unnamed address");
    }
}

const formatAddressInList = (addr) => {
    if (addr.length === 35) {
        return addr;
    } else {
        return addr.substring(0, 17) + "..." + addr.substring(80);
    }
}

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
}

function deepClone(obj) {
    // feel free to make a better implementation
    if (!obj) {
        return null;
    }
    return JSON.parse(JSON.stringify(obj));
}

function setNodeTrText(node, address, key, defaultVal) {
    if (key) {
        node.dataset.tr = key;
        node.id = address;
        node.textContent = tr(key, defaultVal);
    } else {
        delete node.dataset.tr;
        node.textContent = defaultVal;
    }
}

function tr(key, defaultVal) {
    return (settings && settings.lang) ? translate(langDict, key, defaultVal) : defaultVal;
}

function formatEpochTime(epochSeconds) {
    return DateTime.fromMillis(epochSeconds).toLocaleString(DateTime.DATETIME_MED);
}

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
}

function formatBalance(balance, localeTag = undefined) {
    return parseFloat(balance).toLocaleString(localeTag, {minimumFractionDigits: 8, maximumFractionDigits: 8});
}

const _highlightAddr = () => {
  document.querySelectorAll('.addrItem').forEach(function (el) {
    el.addEventListener('click', function (e) {
      document.querySelectorAll('.addrItem').forEach(x => x.classList.remove('active'));
      e.currentTarget.classList.toggle('active');
    });
  });
};
