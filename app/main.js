const { app, ipcMain, BrowserWindow, dialog, Menu } = require('electron');
const applicationMenu = require('./application-menu');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const path = require('path');
const bitcore = require('bitcore-lib-zen');
const Address = bitcore.Address;
const PublicKey = bitcore.PublicKey;
const Networks = bitcore.Networks;
const axios = require("axios");
var csv = require("csvtojson");
const Json2csvParser = require('json2csv').Parser;
var async = require('async');
const {List} = require("immutable");
const remoteMain = require("@electron/remote/main")
remoteMain.initialize()

require('update-electron-app')();

const windows = new Set();
const openFiles = new Map();
let mainWindow;

let axiosApi;

const defaultSettings = {
  explorerUrl: "https://explorer.zen-solutions.io",
  apiUrl: "https://explorer.zen-solutions.io/api",
  csvFormat: "Unformatted",
  refreshIntervalAPI: 334
};

let settings = defaultSettings;

function sleep(millis) {
  return new Promise(resolve => setTimeout(resolve, millis));
};

async function apiGet(url) {
  const resp = await axiosApi(url);
  await sleep(parseFloat(settings.refreshIntervalAPI));
  return resp.data;
}

app.on('ready', () => {
  Menu.setApplicationMenu(applicationMenu)
  mainWindow = new BrowserWindow({ width: 1000, height: 600, icon: "resources/zen_icon.png",
    webPreferences: {
      plugins: true,
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      webSecurity: false
    }, show: false
  });

	mainWindow.setResizable(false);
  remoteMain.enable(mainWindow.webContents);
  mainWindow.loadURL(`file://${__dirname}/render/html/index.html`);

  mainWindow.once('ready-to-show', () => {
		getAddressList(mainWindow);
		mainWindow.webContents.send('ready')
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    windows.delete(mainWindow);
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return false;
  };

  if (process.platform !== 'darwin') {
    app.quit();
  };
});

app.on('activate', (event, hasVisibleWindows) => {
  if (!hasVisibleWindows) { createWindow(); }
});

const getFileFromUser  = exports.getFileFromUser = (targetWindow) => {
	dialog.showOpenDialog(targetWindow, {
		properties: ['openFile'],
		filters: [
			{ name: 'Arizen export Files', extensions: ['csv'] }
		]
	}).then(result => {
		if (result.filePaths) {
			targetWindow.webContents.send('file-opened', result.filePaths.toString());
		}
	}).catch(err => {
		targetWindow.webContents.send('task-running', `File open error: ${err}`);
	});
};

const saveExportedTransactions  = exports.saveExportedTransactions = (targetWindow, csvFormat) => {
	dialog.showSaveDialog(targetWindow, {
		properties: ['saveFile'],
		defaultPath: app.getPath('documents'),
		filters: [
			{ name: 'Comma-separated Values', extensions: ['csv'] }
		]
	}).then(result => {
		if (result.filePath) {
			_saveExportedFile(targetWindow, result.filePath.toString(), csvFormat)
		}
	}).catch(err => {
		targetWindow.webContents.send('task-running', `Saving exported transactions error: ${err}`);
	});
};

const _saveExportedFile = async (targetWindow, file, csvFormat) => {
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});

  const nodePayFromAddrs = [
    "zsf45QuD75XJdm3uLftiW6pucvbhvrbhAhZ",
    "zsoVG9Evw68te8hRAP3xPXSbx9HoH26LUYN",
    "zsi4CcCUYtR1iNjEyjkLPjSVPzSPa4atxt9"
  ]

  let tobexported;
  let nonConsolSqlQuery;
  let consoldateSqlQuery

  switch(csvFormat) {
    case "CrytotaxCalc":
      csvFields = ['Timestamp (UTC)', 'Type', 'Base Currency', 'Base Amount', 'Quote Currency', 'Quote Amount', 'Fee Currency', 'Fee Amount', 'From (Optional)', 'To (Optional)', 'ID (Optional)', 'Description (Optional)' ];
      nonConsolSqlQuery = `SELECT
          datetime(time, 'unixepoch') as 'Timestamp (UTC)',
          IIF(amount < 0, 'transfer-out', 'transfer-in') as Type,
          currency AS 'Base Currency',
          ABS(amount) as 'Base Amount',
          "" AS 'Quote Currency',
          "" AS 'Quote Amount',
          IIF(amount < 0, currency, '') AS 'Fee Currency',
          IIF(amount < 0, fees, '') AS 'Fee Amount',
          vins AS "From (Optional)",
          vouts AS "To (Optional)",
          txid AS "ID (Optional)", ""
          AS 'Description (Optional)'
        FROM transactions
        WHERE
          vins <> "zsf45QuD75XJdm3uLftiW6pucvbhvrbhAhZ"
          AND vins <> "zsoVG9Evw68te8hRAP3xPXSbx9HoH26LUYN"
          AND vins <> "zsi4CcCUYtR1iNjEyjkLPjSVPzSPa4atxt9"`;

      consoldateSqlQuery = `SELECT datetime(time, 'unixepoch') as 'Timestamp (UTC)', 'transfer-in' AS Type, currency AS 'Base Currency', SUM(amount) AS 'Base Amount', "" AS 'Quote Currency', "" AS 'Quote Amount', "" AS 'Fee Currency', "" AS 'Fee Amount', vins AS 'From (Optional)', GROUP_CONCAT(address) AS 'To (Optional)', txid AS 'ID (Optional)', "" AS 'Description (Optional)' FROM transactions`
      allTransactionsStr = await _formatTransactionsForExport(nodePayFromAddrs, db, nonConsolSqlQuery, consoldateSqlQuery, settings.consolidateNodeTxns)
      break;
    case "Cointracking":
      csvFields = ['Type', 'Buy Amount', 'Buy Currency', 'Sell Amount', 'Sell Currency', 'Fee', 'Fee Currency', 'Exchange', 'Trade-Group', 'Comment', 'Date', "Tx-ID", "Buy Value in Account Currrency", "Sell Value in Account Currency" ];

      nonConsolSqlQuery = `SELECT
        IIF(amount < 0, 'Withdrawal', 'Deposit') as Type,
        IIF(amount > 0, ABS(amount), "") as 'Buy Amount',
        IIF(amount > 0, currency, '') as 'Buy Currency',
        IIF(amount < 0, ABS(amount), "") as 'Sell Amount',
        IIF(amount < 0, currency, '') as 'Sell Currency',
        IIF(amount < 0, fees, '') AS 'Fee',
        IIF(amount < 0, currency, '') AS 'Fee Currency',
        walletsource AS 'Exchange',
        "" AS 'Trade-Group',
        description AS Comment,
        strftime('%Y-%m-%d %H:%M:%S', datetime(time, 'unixepoch')) as 'Date',
        txid AS "Tx-ID",
        "" AS "Buy Value in Account Currrency",
        "" AS "Sell Value in Account Currency"
      FROM transactions
      INNER JOIN wallet ON wallet.address = transactions.address
      WHERE
        vins <> "zsf45QuD75XJdm3uLftiW6pucvbhvrbhAhZ"
        AND vins <> "zsoVG9Evw68te8hRAP3xPXSbx9HoH26LUYN"
        AND vins <> "zsi4CcCUYtR1iNjEyjkLPjSVPzSPa4atxt9"`;

      consoldateSqlQuery = `SELECT
          'Deposit' AS Type,
          SUM(amount) AS 'Buy Amount',
          currency AS 'Buy Currency',
          "" AS 'Sell Amount',
          "" AS 'Sell Currency',
          "" AS 'Fee',
          "" AS 'Fee Currency',
          walletsource AS 'Exchange',
          "" AS 'Trade-Group',
          description AS Comment,
          strftime('%Y-%m-%d %H:%M:%S', datetime(time, 'unixepoch')) as 'Date',
          txid AS "Tx-ID",
          "" AS "Buy Value in Account Currrency",
          "" AS "Sell Value in Account Currency"
        FROM transactions
        INNER JOIN wallet ON wallet.address = transactions.address`;
      allTransactionsStr = await _formatTransactionsForExport(nodePayFromAddrs, db, nonConsolSqlQuery, consoldateSqlQuery, settings.consolidateNodeTxns);
      break;
    case "Koinly":
      csvFields = ['Date', 'Sent Amount', 'Sent Currency', 'Received Amount', 'Received Currency', 'Fee Amount', 'Fee Currency', 'Net Worth Amount', 'Net Worth Currency', 'Label', 'Description', 'TxHash' ];
      nonConsolSqlQuery = `SELECT
          strftime('%Y-%m-%d %H:%M UTC', datetime(time, 'unixepoch')) as 'Date',
          IIF(amount < 0, ABS(amount), "") as 'Sent Amount',
          IIF(amount < 0, currency, '') AS 'Sent Currency',
          IIF(amount > 0, ABS(amount), "") as 'Received Amount',
          IIF(amount > 0, currency, '') AS 'Received Currency',
          IIF(amount < 0, fees, '') AS 'Fee Amount',
          IIF(amount < 0, currency, '') AS 'Fee Currency',
          '' AS 'Net Worth Amount',
          '' AS 'Net Worth Currency',
          walletsource AS 'Label',
          description AS 'Description',
          txid AS 'TxHash'
        FROM transactions
        INNER JOIN wallet ON wallet.address = transactions.address
        WHERE
          vins <> "zsf45QuD75XJdm3uLftiW6pucvbhvrbhAhZ"
          AND vins <> "zsoVG9Evw68te8hRAP3xPXSbx9HoH26LUYN"
          AND vins <> "zsi4CcCUYtR1iNjEyjkLPjSVPzSPa4atxt9"`;

      consoldateSqlQuery = `SELECT
          strftime('%Y-%m-%d %H:%M UTC', datetime(time, 'unixepoch')) as 'Date',
          '' as 'Sent Amount',
          '' AS 'Sent Currency',
          SUM(amount) as 'Received Amount',
          currency AS 'Received Currency',
          '' AS 'Fee Amount',
          '' AS 'Fee Currency',
          '' AS 'Net Worth Amount',
          '' AS 'Net Worth Currency',
          walletsource AS 'Label',
          description AS 'Description',
          txid AS "TxHash"
        FROM transactions
        INNER JOIN wallet ON wallet.address = transactions.address`;
        allTransactionsStr = await _formatTransactionsForExport(nodePayFromAddrs, db, nonConsolSqlQuery, consoldateSqlQuery, settings.consolidateNodeTxns);
      break;
    case "Accointing":
      csvFields = ['transactionType', 'date', 'inBuyAmount', 'inBuyAsset', 'outSellAmount', 'outSellAsset', 'feeAmount (optional)', 'feeAsset (optional)', 'classification (optional)', 'operationId (optional)', 'comments (optional)' ];
      nonConsolSqlQuery = `SELECT
          IIF(amount > 0, 'deposit', 'withdraw') as transactionType,
          strftime('%Y/%m/%d %H:%M:%S', datetime(time, 'unixepoch')) as 'date',
          IIF(amount > 0, ABS(amount), "") as 'inBuyAmount',
          IIF(amount > 0, currency, '') AS 'inBuyAsset',
          IIF(amount < 0, ABS(amount), "") as 'outSellAmount',
          IIF(amount < 0, currency, '') AS 'outSellAsset',
          IIF(amount < 0, fees, '') AS 'feeAmount (optional)',
          IIF(amount < 0, currency, '') AS 'feeAsset (optional)',
          "" AS 'classification (optional)',
          txid AS 'operationId (optional)',
          walletsource AS 'comments (optional)'
        FROM transactions
        INNER JOIN wallet ON wallet.address = transactions.address
        WHERE
          vins <> "zsf45QuD75XJdm3uLftiW6pucvbhvrbhAhZ"
          AND vins <> "zsoVG9Evw68te8hRAP3xPXSbx9HoH26LUYN"
          AND vins <> "zsi4CcCUYtR1iNjEyjkLPjSVPzSPa4atxt9"`;

      consoldateSqlQuery = `SELECT
          'deposit' as transactionType,
          strftime('%Y/%m/%d %H:%M:%S', datetime(time, 'unixepoch')) as 'date',
          SUM(amount) as 'inBuyAmount',
          currency AS 'inBuyAsset',
          '' as 'outSellAmount',
          '' AS 'outSellAsset',
          '' AS 'feeAmount (optional)',
          '' AS 'feeAsset (optional)',
          "" AS 'classification (optional)',
          txid AS 'operationId (optional)',
          walletsource AS 'comments (optional)'
        FROM transactions
        INNER JOIN wallet ON wallet.address = transactions.address`;
        allTransactionsStr = await _formatTransactionsForExport(nodePayFromAddrs, db, nonConsolSqlQuery, consoldateSqlQuery, settings.consolidateNodeTxns);
      break;
    case "Unformatted":
      csvFields = ['Timestamp (UTC)', 'Type','Amount Transacted', 'Currency', 'Fee Amount', 'Fee Currency', 'From Address', 'To', 'Transaction ID', 'Wallet Source', 'Description' ];
      nonConsolSqlQuery = `SELECT datetime(time, 'unixepoch') as 'Time (UTC)', IIF(amount < 0, 'out', 'in') as Type, amount as 'Amount Transacted', currency, IIF(amount < 0, fees, '') AS 'Fee Amount', IIF(amount < 0, currency, '') AS 'Fee Currency', vins AS 'From', vouts AS 'To', txid AS 'ID', walletsource AS 'Wallet Source', description AS Description FROM transactions INNER JOIN wallet ON wallet.address = transactions.address`;
      allTransactionsStr = await _formatTransactionsForExport(nodePayFromAddrs, db, nonConsolSqlQuery, consoldateSqlQuery, settings.consolidateNodeTxns);
      break;
  }

  const jsonTransactions = JSON.parse(allTransactionsStr.replace(/\]\,\[/gm, ","));
	const json2csvParser = new Json2csvParser({ csvFields });
	const csv = json2csvParser.parse(jsonTransactions);

	fs.writeFile(file, csv, function(err) {
		if (err) throw err;
		targetWindow.webContents.send('task-running', `File saved successfully to ${file}`);
	});

}

const openFile = exports.openFile = (targetWindow, file) => {
  const content = fs.readFileSync(file).toString();
  app.addRecentDocument(file);
	targetWindow.setRepresentedFilename(file);
	targetWindow.webContents.send('file-opened', file, content);
};

const setSettings = exports.setSettings = (targetWindow, updatedSettings) => {
  settings = updatedSettings;
  axiosApi = axios.create({
    baseURL: settings.apiUrl,
    timeout: 50000,
  });
  mainWindow.webContents.send('settings', updatedSettings);
};

const saveSettings = exports.saveSettings = async(targetWindow) => {
  const b64settings = Buffer.from(JSON.stringify(settings)).toString("base64");
  let db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      dbErrorBox(err, 'connecting to');
    }
  });
  db.run("INSERT OR REPLACE INTO settings (name, value) values ('settings', ?)",b64settings);
};

const loadSettings = exports.loadSettings = async(targetWindow) => {
  let db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      dbErrorBox(err, 'connecting to');
    }
  });
  db.all(`SELECT value FROM settings`, function(err,rows){
    if (err) {
      dbErrorBox(err, 'reading existing settings from')
    }
    if (rows.length === 0) {
      setSettings(targetWindow, defaultSettings);
      return defaultSettings;
    }
    setSettings(targetWindow, JSON.parse(Buffer.from(rows[0].value, "base64").toString("ascii")));
  });
};

const addSingleAddress = exports.addSingleAddress = async(targetWindow, addressText, walletSourceText,  descriptionText) => {
	const newAddresses = [];
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});
	let error = bitcore.Address.getValidationError(addressText, 'livenet');

	if (!error) {
		let validateAddress = bitcore.Address(addressText, 'livenet');
		let isExisting = await _checkExisting(db, addressText);
    let info;
		if (!isExisting) {
			try {
				info = await apiGet(`addr/${addressText}`);
			} catch (err){
				const result = dialog.showMessageBox(mainWindow, {
					type: 'warning',
					title: 'Error connecting to API',
					message: `An error occurred when connecting the API endpoint. \n ${err.message}`,
					buttons: [
						'OK',
					],
					defaultId: 0
				});
				targetWindow.webContents.send('task-running', `Update from API failed, ${err}`);
				return;
			}

			if (info.txApperances > 0) {
				db.run(`INSERT INTO wallet(address, description, walletsource) VALUES(?,?,?)`, [addressText,descriptionText,walletSourceText], function(err) {
					if (err) {
						dbErrorBox(err, 'writing to');
					}
				})
				newAddresses.push({
					address: addressText,
					description: descriptionText,
					walletsource: walletSourceText
				})
			};
		}
    mainWindow.webContents.send('new-addresses', newAddresses);
    targetWindow.webContents.send('searchDerivationPath', `All addresses with a transaction history have been added.`);
	} else {
    targetWindow.webContents.send('searchDerivationPath', `Error: The addresses entered is not a valid Horizen address.`);
	};
	databaseClose(db);


}

const deriveAddressesFromXpub = exports.deriveAddressesFromXpub = async (targetWindow, xpub, walletsource, description) => {
	const newAddresses = [];
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});

	try {
		var hdPublickey = new bitcore.HDPublicKey(xpub);
	} catch (err) {
		let truncError = err.toString().split(" ").splice(1,3).join(" ");
		const result = dialog.showMessageBox(targetWindow, {
			type: 'warning',
			title: 'Invalid xpub address entered',
			message: `The xpub that was entered failed validation. Please check the xpub value and try again. \n \n The error returned was: \n${truncError}`,
			buttons: [
				'OK',
			],
			defaultId: 0,
		});
		targetWindow.getElementById(addressTextBox).value = '';
		return;
	}


	for (let step = 0; step < 2; step++) {
		var i = 0;
		var addrIndex = 0;
		do {
			let derivation = 'm/' + step + '/' + addrIndex;
			let orderPublickey = hdPublickey.derive(derivation);
			let pubkey = new PublicKey(orderPublickey.publicKey);
			let address = Address.fromPublicKey(pubkey, Networks.mainnet);
			targetWindow.webContents.send('searchDerivationPath', `Searching transactions for ${address.toString()} with derivation ${derivation}`);
			let isExisting = await _checkExisting(db, address);
      let info;

			if (isExisting === false) {
				try {
					info = await apiGet(`addr/${address.toString()}`);
				} catch (err){
					const result = dialog.showMessageBox(mainWindow, {
						type: 'warning',
						title: 'Error connecting to API',
						message: `An error occurred when connecting the API endpoint. \n ${err.message}`,
						buttons: [
							'OK',
						],
						defaultId: 0
					});
          targetWindow.webContents.send('searchDerivationPath', `Update from API failed, ${err}`)
					targetWindow.webContents.send('task-running', `Update from API failed, ${err}`);
          targetWindow.webContents.send('completed-import');
					return;
				}

				if (info.txApperances > 0) {
					db.run(`INSERT INTO wallet(address, xpub, derivation, description, walletsource) VALUES(?,?,?,?,?)`, [address.toString(),xpub,derivation,description,walletsource], function(err) {
						if (err) {
							dbErrorBox(err, 'writing to');
						}
					})
					newAddresses.push({
						address: address.toString(),
						description: description,
						walletsource: walletsource
					})
				};
				i = info.txApperances
			} else {
				i = 1;
			};
			addrIndex++;
		} while (i != 0)
	}
	databaseClose(db);

	mainWindow.webContents.send('new-addresses', newAddresses);
	targetWindow.webContents.send('searchDerivationPath', `All addresses with a transaction history have been added.`);
  targetWindow.webContents.send('completed-import');

};

const loadAddressesFromFile = exports.loadAddressesFromFile = async (targetWindow, file, walletsource, description) => {
	let newAddresses = [];
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});
	const newAddrObjs = await csv().fromFile(file);
	let addrObjs = await _db_all(db, `SELECT address, walletsource, description FROM wallet`);

	const addrSet = new Set();
	for (const obj of newAddrObjs) {
		let address = obj.addr;
		let description = obj.description;
		let source = obj.source;
		addrSet.add({address,description,source});
	};
	var resultAddrArray = Object.values(JSON.parse(JSON.stringify(addrObjs)));
	resultAddrArray.forEach(element => {
		addrSet.forEach(obj => {
			if (obj.address === element.address) {
				addrSet.delete(obj);
			}
		})
	});
	let newAddressesArray = Array.from(addrSet);

	for (let i = 0; i < newAddressesArray.length; i++) {
		let isExisting = await _checkExisting(db, newAddressesArray[i].address);
    let info;
		if (isExisting === false) {
			try {
				targetWindow.webContents.send('searchDerivationPath', `Confirming transaction history for ${newAddressesArray[i].address} (${i + 1}/${newAddressesArray.length})`);
				info = await apiGet(`addr/${newAddressesArray[i].address}`);
			} catch (err){
        const result = dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Error connecting to API',
          message: `An error occurred when connecting the API endpoint. \n ${err.message}`,
          buttons: [
            'OK',
          ],
          defaultId: 0
        });
				targetWindow.webContents.send('searchDerivationPath', `Unable to return API : ${err} \nAPI call : /addr/${newAddressesArray[i].address}`);
				return;
			}

			if (info.txApperances > 0) {
				db.run(`INSERT INTO wallet(address, walletsource, description) VALUES(?,?,?)`, [newAddressesArray[i].address,newAddressesArray[i].source,newAddressesArray[i].description], function(err) {
					if (err) {
						dbErrorBox(err, 'writing to');
					}
				});
				newAddresses.push({
					address: newAddressesArray[i].address,
					description: newAddressesArray[i].description,
					walletsource: newAddressesArray[i].source
				})
			};
		}
	};
	databaseClose(db);
	mainWindow.webContents.send('new-addresses', newAddresses);
	targetWindow.webContents.send('searchDerivationPath', `All addresses with a transaction history have been added.`);
  targetWindow.webContents.send('completed-import');
}

const removeSingleAddress = exports.removeSingleAddress = async (targetWindow, address) => {
  let db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      dbErrorBox(err, 'connecting to');
    }
  });

  db.run("DELETE FROM wallet WHERE address=(?)", address, function(err) {
    if (err) {
			dbErrorBox(err, 'deleting from');
		}
  })

  db.run("DELETE FROM transactions WHERE address=(?)", address, function(err) {
    if (err) {
			dbErrorBox(err, 'deleting from');
		}
  })
  let existingAddresses = await _db_all(db, `SELECT address, description, walletsource FROM wallet`);
  targetWindow.webContents.send('addresses-loaded', existingAddresses);
  databaseClose(db);
}

var documentPath = app.getPath('appData');
try {
	fs.accessSync(path.join(documentPath, 'HorizenTxHistoryApp'));
} catch (e) {
	fs.mkdirSync(path.join(documentPath, 'HorizenTxHistoryApp'));
}

try {
	fs.accessSync(path.join(documentPath, 'HorizenTxHistoryApp', 'db'));
} catch (e) {
	fs.mkdirSync(path.join(documentPath, 'HorizenTxHistoryApp', 'db'));
}

const dbPath = path.join(documentPath, 'HorizenTxHistoryApp', 'db', 'HorizenTxHistoryApp.db');
var exists = fs.existsSync(dbPath);

if (!exists) {
  let db = new sqlite3.Database(dbPath, createTables);
  function createTables() {
  	db.serialize(()  => {
  		db.run('CREATE TABLE IF NOT EXISTS wallet (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT UNIQUE, xpub TEXT, derivation TEXT, walletsource TEXT, description TEXT)');
      db.run('CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, value TEXT)');
      db.run('CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, txid TEXT, time INTEGER, address TEXT, vins TEXT, vouts TEXT, amount REAL, fees DECIMAL(8,8), block INTEGER, currency TEXT)');
  	});
		databaseClose(db);
  };
};

const databaseClose = (db) => {
	db.close((err) => {
		if (err) {
			const result = dialog.showMessageBox(mainWindow, {
				type: 'warning',
				title: 'Error closing database',
				message: `An error occurred when closing the database. \n ${err.message})`,
				buttons: [
					'OK',
				],
				defaultId: 0
			});
		};
	});
};

const dbErrorBox = (err, errorType) => {
	const result = dialog.showMessageBox(mainWindow, {
		type: 'error',
		title: `Error ${errorType} database`,
		message: `An error occurred when accessing the database. \n ${err.message})`,
		buttons: [
			'OK',
		],
		defaultId: 0
	});
};

async function _db_all(db, query){
  return new Promise(function(resolve,reject){
    db.all(query, function(err,rows){
			if (err) {
				dbErrorBox(err)
			}
			resolve(rows);
    });
  });
};

async function _db_each(db, query){
    return new Promise(function(resolve,reject){
        db.each(query, (err,rows) => {
					if (err) {
						dbErrorBox(err)
					}
           resolve(rows);
         });
    });
};

async function _checkExisting(db, newAddress) {
	let existingAddresses = await _db_all(db, `SELECT address FROM wallet`);
	for (let j = 0; j < existingAddresses.length; j++) {
		if (existingAddresses[j].address === newAddress.toString()) {
			return true;
		};
	};
	return false;
};

const getAddressList = exports.getAddressList = async (targetWindow) => {
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});
	let existingAddresses = await _db_all(db, `SELECT address, description, walletsource FROM wallet`);
	targetWindow.webContents.send('addresses-loaded', existingAddresses);
	databaseClose(db);
};

const getTransactionsByAddress = exports.getTransactionsByAddress = async (targetWindow, address) => {
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});
	let txList = await _db_all(db, `SELECT * FROM transactions WHERE address = '${address}'`);
	targetWindow.webContents.send('address-transactions', txList);
	databaseClose(db);
}

const getExistingTxList = async (targetWindow) => {
	let txArray = [];
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});
	let existingTransactions = await _db_all(db, `SELECT address,txid FROM transactions`);
	databaseClose(db);
	return existingTransactions;
};

const fetchAllTransactions = exports.fetchAllTransactions = async (targetWindow) => {
	let db = new sqlite3.Database(dbPath, (err) => {
		if (err) {
			dbErrorBox(err, 'connecting to');
		}
	});
	let addrObjs = await _db_all(db, `SELECT address FROM wallet`);

	const knownTxIds = await getExistingTxList(targetWindow);
	try {
		transactions = await _fetchUnknownTransactions(addrObjs, knownTxIds, targetWindow);
	} catch (err) {
    const result = dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Error connecting to API',
      message: `An error occurred when connecting the API endpoint. \n ${err.message}`,
      buttons: [
        'OK',
      ],
      defaultId: 0
    });
    let errType;
    if (err.message.toString().includes("429")) {
      errType = "Rate Limited"

    }
		targetWindow.webContents.send('task-running', `Update from API failed: ${err} \n - ${errType}`);
		return;
	};
	targetWindow.webContents.send('task-running', `All transactions saved`);
  return;
}

async function _fetchUnknownTransactions(addrObjs, knownTxIds, targetWindow) {
  const result = {
    changedAddrs: [],
    newTxs: []
  };

  for (const obj of addrObjs) {
		targetWindow.webContents.send('task-running', `Fetching transaction information for ${obj.address}`);

    let info = await apiGet("/addr/" + obj.address);
		let address = info.addrStr;
    if (info.txAppearances) {
      for (let i = 0; i < Math.ceil(info.txAppearances); i+=10) {
        const txIdSet = new Set();
        let db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            dbErrorBox(err, 'connecting to');
          }
        });
        let infoPg = await apiGet(`/addr/${obj.address}?from=${i}&to=${i+10}`)

        targetWindow.webContents.send('task-running', `Scanning existing transaction information for ${obj.address} \n(${i}/${Math.ceil(info.txAppearances)})`);
        infoPg.transactions.forEach(txid => txIdSet.add({address,txid}));

        var resultArray = Object.values(JSON.parse(JSON.stringify(knownTxIds)));
        resultArray.forEach(element => {
          txIdSet.forEach(obj => {
            if (obj.address === element.address && obj.txid === element.txid) {
              txIdSet.delete(obj);
            }
          })
        });
        try {
          newTransactions = await _fetchTransactionDetails(txIdSet, addrObjs, info.txAppearances, i, targetWindow);
        } catch (err) {
          targetWindow.webContents.send('task-running', `Error getting transaction details from API:  ${err}`);
          return;
        }
        let count = 0;
        async.eachOf(newTransactions, function(tx) {
          db.run(`INSERT INTO transactions (txid, time, address, vins, vouts, amount, fees, block, currency) VALUES (?,?,?,?,?,?,?,?,?)`, [tx.txid, tx.time, tx.address, tx.vins, tx.vouts, tx.amount, tx.fees, tx.block, 'ZEN'], function(err) {
            if (err) {
              dbErrorBox(err, 'writing to');
            }
          })
          count++;
        });
        databaseClose(db);
      }
    }
  }
}

async function _fetchTransactionDetails(txIds, myAddrs, appearances, page, targetWindow) {
    const txs = [];
		const myAddrSetOrig = new Set(!Array.isArray(myAddrs) ? [myAddrs] : myAddrs);
    let totalTx = 0;
    for (const c of txIds) {
      totalTx = totalTx + 1;
    };
		let txNumber = 1;

    for (const txId of txIds) {
			  const myAddrSet = new Set([txId.address]);
        let info;
				targetWindow.webContents.send('task-running', `Fetching transaction ${txId.txid} for  ${txId.address} \n(${txNumber + page}/${appearances})`);
        try {
          info = await apiGet("tx/" + txId.txid);
        } catch (err) {
          const result = dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Error connecting to API',
            message: `An error occurred when connecting the API endpoint. \n ${err.message}`,
            buttons: [
              'OK',
            ],
            defaultId: 0
          });
          targetWindow.webContents.send('task-running', `Update from API failed, ${err}`);
          return;
        }

        let txBalance = 0;
        const vins = [];
        const vouts = [];

        // Address field in transaction rows is meaningless. Pick something sane.
        let firstMyAddr;

        const filteredVout = await getFilteredVout(myAddrSet, info.vout);
        const filteredVin = await getFilteredVin(myAddrSet, info.vin);

        for (const vout of filteredVout) {
            // XXX can it be something else?
            if (!vout.scriptPubKey) {
                continue;
            }
            let balanceAccounted = false;
            for (const addr of vout.scriptPubKey.addresses) {
                if (!balanceAccounted && myAddrSet.has(addr)) {
                    balanceAccounted = true;
                    txBalance += parseFloat(vout.value);
                    if (!firstMyAddr) {
                        firstMyAddr = addr;
                    }
                }

                if (!vouts.includes(addr)) {
                    vouts.push(addr);
                }
            }
        }

        for (const vin of filteredVin) {
            const addr = vin.addr;
            if (myAddrSet.has(addr)) {
                txBalance -= parseFloat(vin.value);
                if (!firstMyAddr) {
                    firstMyAddr = addr;
                }
            }

            if (!vins.includes(addr)) {
							vins.push(addr);
					}
			}

			const isWithdraw = txBalance < 0;
			const tx = {
					txid: info.txid,
					time: info.blocktime,
					address: firstMyAddr,
					vins: isWithdraw ? [...new Set(filteredVin.map(vin => vin.addr))].join(',') : [...new Set(info.vin.map(vin => vin.addr))].join(','),
					vouts: isWithdraw ? [...new Set(info.vout.map(vout => vout.scriptPubKey.addresses[0]))].join(',') : [...new Set(filteredVout.map(vout => vout.scriptPubKey.addresses[0]))].join(','),
					amount: txBalance,
					block: info.blockheight,
          fees: info.fees
			};

			txs.push(tx);
		txNumber++;
	}

	return txs;
}

/**
 * @param {Set} address
 * @param {object[]} originalVout
 */
function getFilteredVout(address, originalVout) {
    return new Promise(resolve => {
        resolve(originalVout.filter(vout => {
            if (!vout.scriptPubKey.addresses) {
                return false;
            }

            return address.has(vout.scriptPubKey.addresses[0]);
        }));
    });
}

/**
 * @param {Set} address
 * @param {object[]} originalVin
 */
function getFilteredVin(address, originalVin) {
    return new Promise(resolve => {
        resolve(originalVin.filter(vin => {
            return address.has(vin.addr);
        }));
    });
}

const _formatTransactionsForExport = async (nodePayFromAddrs, db, sqlNonConsolQuery, sqlConsolQuery, consolidateFlag) => {
  let allTransactionsStr;
  if (consolidateFlag == false || !sqlConsolQuery) {
    sqlNonConsolQuery = sqlNonConsolQuery.split('WHERE')[0];
    nonConsolidatedObj = await _db_all(db, sqlNonConsolQuery);
    allTransactionsStr = JSON.stringify(nonConsolidatedObj);

    return allTransactionsStr;
  } else if (consolidateFlag == true){
    nonConsolidatedObj = await _db_all(db, sqlNonConsolQuery);
    allTransactionsStr = JSON.stringify(nonConsolidatedObj);

    for (const nodeAddr of Object.keys(nodePayFromAddrs)) {
      nodeTxns = await _db_all(db, `SELECT txid, COUNT(*) FROM transactions WHERE vins = '${nodePayFromAddrs[nodeAddr]}' GROUP BY txid HAVING COUNT(*) > 0`)
      for (var nodeTxid of Object.keys(nodeTxns)) {
        let consolidatedTxnsObj = await _db_all(db, sqlConsolQuery + ` WHERE txid = "${nodeTxns[nodeTxid].txid}";`);
        allTransactionsStr = allTransactionsStr + "," + JSON.stringify(consolidatedTxnsObj)
      }
    }

    return allTransactionsStr;
  }
}
