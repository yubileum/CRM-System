import React, { useState } from 'react';
import { Footer } from './Footer';
import { Database, Copy, Check, ArrowRight, FileSpreadsheet, Server, Zap, LogOut } from 'lucide-react';
import { setApiUrl } from '../services/storage';

interface SetupViewProps {
  onComplete: () => void;
  onLogout?: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({ onComplete, onLogout }) => {
  const [mode, setMode] = useState<'connect' | 'create'>('connect');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSave = () => {
    if (!url.includes('script.google.com')) {
      alert('Please enter a valid Google Apps Script Web App URL');
      return;
    }
    setApiUrl(url);
    onComplete();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center font-sans">
      <div className="max-w-2xl w-full bg-gray-800 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-brand-600 p-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
              <Database size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">System Setup</h1>
              <p className="text-brand-100 font-medium">Connect to Dice database.</p>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 bg-brand-700 hover:bg-brand-800 rounded-lg text-brand-100 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setMode('connect')}
            className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors ${mode === 'connect' ? 'bg-gray-800 text-brand-400 border-b-2 border-brand-500' : 'bg-gray-900/50 text-gray-500 hover:text-gray-300'}`}
          >
            Existing Store
          </button>
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-4 font-bold text-sm tracking-wide transition-colors ${mode === 'create' ? 'bg-gray-800 text-brand-400 border-b-2 border-brand-500' : 'bg-gray-900/50 text-gray-500 hover:text-gray-300'}`}
          >
            Create New Database
          </button>
        </div>

        <div className="p-8">

          {mode === 'connect' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-brand-900/20 border border-brand-500/20 rounded-xl p-4 flex gap-4">
                <div className="p-2 bg-brand-500/20 rounded-lg h-fit text-brand-400"><Zap size={20} /></div>
                <div>
                  <h3 className="font-bold text-brand-400 text-sm mb-1">Quick Connect</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Scan a <strong>Configuration QR Code</strong> from an existing admin device to connect instantly.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">Or Enter Link Manually</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                      <FileSpreadsheet size={18} />
                    </div>
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://script.google.com/..."
                      className="w-full bg-gray-900 border border-gray-600 rounded-xl py-3 pl-10 pr-4 text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all font-mono text-xs"
                    />
                  </div>
                  <button
                    onClick={handleSave}
                    className="bg-brand-600 hover:bg-brand-500 text-white px-6 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                  >
                    Connect <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-brand-400 font-bold uppercase tracking-widest text-xs">
                  <span className="w-6 h-6 rounded-full border border-brand-500 flex items-center justify-center text-[10px]">1</span>
                  <span>Deploy Backend</span>
                </div>

                <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 text-xs text-gray-400 space-y-2 leading-relaxed">
                  <p>1. Create a new <a href="https://sheets.new" target="_blank" className="text-brand-400 hover:underline">Google Sheet</a>.</p>
                  <p>2. Go to <strong>Extensions &gt; Apps Script</strong>.</p>
                  <p>3. <strong>Delete all code</strong> in <code>Code.gs</code> and paste the code below.</p>
                  <p>4. Click <strong>Deploy &gt; New Deployment</strong>.</p>
                  <p>5. Click the gear icon &gt; <strong>Web App</strong>.</p>
                  <p>6. <span className="text-red-400 font-bold">IMPORTANT:</span> Set "Who has access" to <strong>Anyone</strong>.</p>
                  <p>7. Copy the <strong>Web App URL</strong> and switch back to the "Existing Store" tab.</p>
                </div>

                <div className="relative group">
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={copyCode}
                      className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <pre className="bg-black/50 p-4 rounded-xl text-xs text-gray-300 overflow-x-auto h-48 border border-gray-700 font-mono scrollbar-thin scrollbar-thumb-gray-600">
                    {APPS_SCRIPT_CODE}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>
        <Footer light />
      </div>
    </div>
  );
};

const APPS_SCRIPT_CODE = `
/**
 * DICE BACKEND - V6 (Consistency Fix)
 * - Added SpreadsheetApp.flush() to ensure updates are instantly visible to other devices.
 * - Unified parameter parsing to support both GET and POST for all actions.
 */

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonResponse({ success: false, error: "Server busy, please try again." });
  }
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Unified Request Data Parsing
    // Merges query parameters with JSON body (JSON takes precedence)
    let requestData = e.parameter || {};
    if (e.postData && e.postData.contents) {
      try {
        const jsonBody = JSON.parse(e.postData.contents);
        requestData = { ...requestData, ...jsonBody };
      } catch (err) {
        // Fallback to ignoring body if invalid JSON
      }
    }

    const action = requestData.action;

    // 2. Setup Tables
    const usersSheet = getOrCreateSheet(doc, 'Users', [
      'id', 'username', 'password', 'name', 'email', 'phone', 'address', 'birthDate', 'currentStamps', 'maxStamps', 'createdAt'
    ]);
    
    const txSheet = getOrCreateSheet(doc, 'Transactions', [
      'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
    ]);

    let result = { success: false };

    // --- ACTIONS ---

    if (action === 'register') {
      const allUsers = usersSheet.getDataRange().getValues();
      const inputUser = String(requestData.username || '').trim().toLowerCase();
      
      const exists = allUsers.slice(1).some(row => String(row[1]).trim().toLowerCase() === inputUser);
      
      if (exists) {
        result = { success: false, error: "Username already exists." };
      } else {
        const newUser = [
          requestData.id || 'user-' + new Date().getTime(),
          String(requestData.username || '').trim(),
          String(requestData.password || '').trim(),
          requestData.name,
          requestData.email,
          requestData.phone,
          requestData.address || '',
          requestData.birthDate || '',
          0,
          10,
          new Date().toISOString()
        ];
        usersSheet.appendRow(newUser);
        SpreadsheetApp.flush(); // FORCE SAVE immediately
        result = { success: true, user: mapRowToUser(newUser, []) };
      }
    }

    else if (action === 'login') {
      const allUsers = usersSheet.getDataRange().getValues();
      const inputUser = String(requestData.username || '').trim().toLowerCase();
      const inputPass = String(requestData.password || '').trim();

      if (allUsers.length <= 1) {
         result = { success: false, error: "Database is empty." };
      } else {
         const row = allUsers.slice(1).find(r => 
           String(r[1]).trim().toLowerCase() === inputUser && 
           String(r[2]).trim() === inputPass
         );

         if (row) {
           // Only return user data, no history for login (lightweight)
           result = { success: true, user: mapRowToUser(row, []) };
         } else {
           result = { success: false, error: "Invalid username or password." };
         }
      }
    }

    else if (action === 'getUser') {
      const userId = String(requestData.id).trim();
      const allUsers = usersSheet.getDataRange().getValues();
      const row = allUsers.slice(1).find(r => String(r[0]) === userId);
      
      if (row) {
        const history = getTransactionsForUser(txSheet, row[0]);
        result = { success: true, user: mapRowToUser(row, history) };
      } else {
        result = { success: false, error: "User not found." };
      }
    }

    else if (action === 'addStamp') {
      const userId = requestData.userId;
      const allUsers = usersSheet.getDataRange().getValues();
      
      const userIndex = allUsers.slice(1).findIndex(r => String(r[0]) === String(userId));

      if (userIndex === -1) {
        result = { success: false, error: "User not found." };
      } else {
        const realRow = userIndex + 2;
        const currentStamps = parseInt(allUsers[userIndex + 1][8] || 0); 
        const maxStamps = parseInt(allUsers[userIndex + 1][9] || 10);
        
        if (currentStamps < maxStamps) {
          usersSheet.getRange(realRow, 9).setValue(currentStamps + 1);
          
          const txId = 'tx-' + new Date().getTime();
          const now = new Date();
          txSheet.appendRow([
             txId, userId, 'add', 1, now.getTime(), now.toISOString()
          ]);
          
          SpreadsheetApp.flush(); // FORCE SAVE immediately
          
          const history = getTransactionsForUser(txSheet, userId);
          const updatedRow = [...allUsers[userIndex + 1]];
          updatedRow[8] = currentStamps + 1;
          
          result = { success: true, user: mapRowToUser(updatedRow, history) };
        } else {
          result = { success: false, error: "Max stamps reached." };
        }
      }
    }
    
    else if (action === 'getAll') {
       const allUsers = usersSheet.getDataRange().getValues().slice(1);
       result = { users: allUsers.map(r => mapRowToUser(r, [])) };
    }

    else {
      result = { success: false, error: "Unknown action" };
    }

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateSheet(doc, name, headers) {
  let sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getTransactionsForUser(sheet, userId) {
  const allTx = sheet.getDataRange().getValues().slice(1);
  const userTx = allTx.filter(r => String(r[1]) === String(userId));
  userTx.sort((a, b) => b[4] - a[4]);
  return userTx.map(r => ({
    id: r[0],
    timestamp: Number(r[4]),
    type: r[2],
    amount: Number(r[3])
  }));
}

function mapRowToUser(row, history) {
  return {
    id: row[0],
    username: row[1],
    // password: row[2], 
    name: row[3],
    email: row[4],
    phone: row[5],
    address: row[6],
    birthDate: row[7],
    stamps: parseInt(row[8] || 0),
    maxStamps: parseInt(row[9] || 10),
    history: history
  };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`.trim();