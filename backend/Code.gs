/**
 * DICE BACKEND - V15 (Added Admin List)
 * 1. Run 'setup' function manually first to authorize scopes.
 * 2. Deploy as Web App -> Execute as: "Me", Access: "Anyone".
 * COLUMN ORDER: id | name | email | phone | address | referralCode | birthDate | currentStamps | maxStamps | createdAt
 */

function setup() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  getOrCreateSheet(doc, 'Users', [
      'id', 'name', 'email', 'phone', 'address', 'referralCode', 'birthDate', 'currentStamps', 'maxStamps', 'createdAt'
  ]);
  getOrCreateSheet(doc, 'Transactions', [
      'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
  ]);
  getOrCreateSheet(doc, 'CheckpointConfig', [
      'maxStamps', 'checkpoints'
  ]);
  // NEW: Initialize Vouchers sheet
  getOrCreateSheet(doc, 'Vouchers', [
      'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
  ]);
  // NEW: Initialize AdminList sheet
  getOrCreateSheet(doc, 'AdminList', [
      'id', 'name', 'code'
  ]);
  Logger.log("Setup Complete. You can now Deploy.");
}

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return jsonResponse({ success: false, error: "Server busy, please try again." });
  }
  
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    let requestData = e.parameter || {};
    if (e.postData && e.postData.contents) {
      try {
        const jsonBody = JSON.parse(e.postData.contents);
        requestData = { ...requestData, ...jsonBody };
      } catch (err) {}
    }

    const action = requestData.action;
    const usersSheet = getOrCreateSheet(doc, 'Users', [
      'id', 'name', 'email', 'phone', 'address', 'referralCode', 'birthDate', 'currentStamps', 'maxStamps', 'createdAt'
    ]);
    
    const txSheet = getOrCreateSheet(doc, 'Transactions', [
      'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
    ]);

    let result = { success: false };

    if (action === 'register') {
      const allUsers = usersSheet.getDataRange().getValues();
      const inputPhone = String(requestData.phone || '').trim().replace(/\s/g, '');
      
      const exists = allUsers.slice(1).some(row => String(row[3]).trim().replace(/\s/g, '') === inputPhone);
      
      if (exists) {
        result = { success: false, error: "Phone number already registered." };
      } else {
        const newUser = [
          requestData.id || 'user-' + new Date().getTime(),
          requestData.name,
          requestData.email,
          String(requestData.phone || '').trim(),
          requestData.address || '',
          String(requestData.adminReferral || '').trim(),  // referralCode
          String(requestData.birthDate || '').trim(),
          0,   // currentStamps
          10,  // maxStamps
          new Date().toISOString()
        ];
        usersSheet.appendRow(newUser);
        SpreadsheetApp.flush();
        result = { success: true, user: mapRowToUser(newUser, []) };
      }
    }

    else if (action === 'login') {
      const allUsers = usersSheet.getDataRange().getValues();
      const inputPhone = String(requestData.username || '').trim().replace(/\s/g, '');
      const inputBirth = String(requestData.password || '').trim();

      if (allUsers.length <= 1) {
         result = { success: false, error: "Database is empty." };
      } else {
         const row = allUsers.slice(1).find(r => {
           const sheetPhone = String(r[3]).trim().replace(/\s/g, '');
           const sheetDate = formatDate(r[6]); // birthDate is now col index 6
           return sheetPhone === inputPhone && sheetDate === inputBirth;
         });

         if (row) {
           result = { success: true, user: mapRowToUser(row, []) };
         } else {
           result = { success: false, error: "Invalid phone number or birth date." };
         }
      }
    }

    else if (action === 'getUser') {
      const userId = String(requestData.id).trim();
      const allUsers = usersSheet.getDataRange().getValues();
      const row = allUsers.slice(1).find(r => String(r[0]) === userId);
      
      if (row) {
        result = { success: true, user: mapRowToUser(row, []) };
      } else {
        result = { success: false, error: "User not found." };
      }
    }

    else if (action === 'getHistory') {
      const userId = String(requestData.userId).trim();
      const history = getTransactionsForUser(txSheet, userId);
      result = { success: true, history: history };
    }

    else if (action === 'addStamp') {
      const userId = requestData.userId;
      const allUsers = usersSheet.getDataRange().getValues();
      const userIndex = allUsers.slice(1).findIndex(r => String(r[0]) === String(userId));

      if (userIndex === -1) {
        result = { success: false, error: "User not found." };
      } else {
        const realRow = userIndex + 2;
        const currentStamps = parseInt(allUsers[userIndex + 1][7] || 0); // stamps now col 7
        const maxStamps = parseInt(allUsers[userIndex + 1][8] || 10);    // maxStamps now col 8
        
        if (currentStamps < maxStamps) {
          const newStampCount = currentStamps + 1;
          usersSheet.getRange(realRow, 8).setValue(newStampCount); // currentStamps is col 8 (1-indexed)
          const now = new Date();
          txSheet.appendRow(['tx-' + now.getTime(), userId, 'add', 1, now.getTime(), now.toISOString()]);
          SpreadsheetApp.flush();
          
          // Check if this stamp count is a checkpoint
          const checkpointConfig = getCheckpointConfiguration(doc);
          const checkpoint = checkIfCheckpoint(newStampCount, checkpointConfig);
          let newVoucher = null;
          
          if (checkpoint) {
            // Generate voucher for this checkpoint
            newVoucher = generateVoucher(doc, userId, newStampCount, checkpoint.reward);
          }
          
          const history = getTransactionsForUser(txSheet, userId);
          const updatedRow = [...allUsers[userIndex + 1]];
          updatedRow[6] = newStampCount;
          result = { 
            success: true, 
            user: mapRowToUser(updatedRow, history),
            voucher: newVoucher // Include voucher if checkpoint reached
          };
        } else {
          result = { success: false, error: "Max stamps reached." };
        }
      }
    }
    
    else if (action === 'getAll') {
       const allUsers = usersSheet.getDataRange().getValues().slice(1);
       result = { users: allUsers.map(r => mapRowToUser(r, [])) };
    }

    // NEW: Get checkpoint configuration
    else if (action === 'getCheckpointConfig') {
      const configSheet = getOrCreateSheet(doc, 'CheckpointConfig', ['maxStamps', 'checkpoints']);
      const data = configSheet.getDataRange().getValues();
      
      if (data.length < 2) {
        // Return default configuration
        result = {
          success: true,
          config: {
            maxStamps: 10,
            checkpoints: [
              { stampCount: 3, reward: 'Free Lychee Tea' },
              { stampCount: 5, reward: 'diskon 15% off game' },
              { stampCount: 7, reward: 'Free french fries' },
              { stampCount: 10, reward: 'Free all day pass' }
            ]
          }
        };
      } else {
        const maxStamps = parseInt(data[1][0]) || 10;
        let checkpoints = [];
        try {
          checkpoints = JSON.parse(data[1][1] || '[]');
        } catch (e) {
          checkpoints = [];
        }
        
        result = {
          success: true,
          config: {
            maxStamps: maxStamps,
            checkpoints: checkpoints
          }
        };
      }
    }

    // NEW: Save checkpoint configuration
    else if (action === 'saveCheckpointConfig') {
      const configSheet = getOrCreateSheet(doc, 'CheckpointConfig', ['maxStamps', 'checkpoints']);
      const maxStamps = parseInt(requestData.maxStamps) || 10;
      const checkpoints = requestData.checkpoints || [];
      
      // Clear existing data (except header)
      if (configSheet.getLastRow() > 1) {
        configSheet.deleteRows(2, configSheet.getLastRow() - 1);
      }
      
      // Add new configuration
      configSheet.appendRow([
        maxStamps,
        JSON.stringify(checkpoints)
      ]);
      SpreadsheetApp.flush();
      
      result = {
        success: true,
        config: {
          maxStamps: maxStamps,
          checkpoints: checkpoints
        }
      };
    }

    // NEW: Get user vouchers
    else if (action === 'getUserVouchers') {
      const userId = String(requestData.userId).trim();
      const vouchersSheet = getOrCreateSheet(doc, 'Vouchers', [
        'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
      ]);
      
      const allVouchers = vouchersSheet.getDataRange().getValues().slice(1);
      const userVouchers = allVouchers
        .filter(row => String(row[1]) === userId)
        .map(row => {
          const now = new Date();
          const expiresAt = new Date(row[5]);
          let status = row[7];
          
          // Auto-update expired vouchers
          if (status === 'active' && expiresAt < now) {
            status = 'expired';
          }
          
          return {
            id: row[0],
            userId: row[1],
            checkpointStampCount: parseInt(row[2]),
            rewardName: row[3],
            createdAt: row[4],
            expiresAt: row[5],
            redeemedAt: row[6] || null,
            status: status
          };
        });
      
      result = { success: true, vouchers: userVouchers };
    }

    // NEW: Redeem voucher
    else if (action === 'redeemVoucher') {
      const voucherId = String(requestData.voucherId).trim();
      const userId = String(requestData.userId).trim();
      
      const vouchersSheet = getOrCreateSheet(doc, 'Vouchers', [
        'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
      ]);
      
      const allVouchers = vouchersSheet.getDataRange().getValues();
      const voucherIndex = allVouchers.slice(1).findIndex(r => String(r[0]) === voucherId);
      
      if (voucherIndex === -1) {
        result = { success: false, error: "Voucher not found." };
      } else {
        const voucherRow = allVouchers[voucherIndex + 1];
        const voucherUserId = String(voucherRow[1]);
        const expiresAt = new Date(voucherRow[5]);
        const currentStatus = voucherRow[7];
        const now = new Date();
        
        // Validate ownership
        if (voucherUserId !== userId) {
          result = { success: false, error: "This voucher does not belong to you." };
        }
        // Check if already redeemed
        else if (currentStatus === 'redeemed') {
          result = { success: false, error: "This voucher has already been redeemed." };
        }
        // Check if expired
        else if (expiresAt < now || currentStatus === 'expired') {
          result = { success: false, error: "This voucher has expired." };
        }
        else {
          // Redeem the voucher
          const realRow = voucherIndex + 2;
          vouchersSheet.getRange(realRow, 7).setValue(now.toISOString()); // redeemedAt
          vouchersSheet.getRange(realRow, 8).setValue('redeemed'); // status
          
          // Log transaction
          txSheet.appendRow([
            'tx-' + now.getTime(),
            userId,
            'voucher_redeemed',
            1,
            now.getTime(),
            now.toISOString()
          ]);
          
          SpreadsheetApp.flush();
          
          result = {
            success: true,
            voucher: {
              id: voucherRow[0],
              userId: voucherRow[1],
              checkpointStampCount: parseInt(voucherRow[2]),
              rewardName: voucherRow[3],
              createdAt: voucherRow[4],
              expiresAt: voucherRow[5],
              redeemedAt: now.toISOString(),
              status: 'redeemed'
            }
          };
        }
      }
    }

    // Dashboard analytics
    else if (action === 'getDashboardData') {
      const allUsers = usersSheet.getDataRange().getValues().slice(1);
      const allTx = txSheet.getDataRange().getValues().slice(1);

      const now = new Date();
      const msPerDay = 24 * 60 * 60 * 1000;
      const msPerWeek = 7 * msPerDay;
      const oneMonthAgo = new Date(now.getTime() - 30 * msPerDay);

      // --- Total members ---
      const totalMembers = allUsers.length;

      // --- New members per week (last 8 weeks) ---
      const weeklyGrowth = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * msPerWeek);
        const weekStart = new Date(weekEnd.getTime() - msPerWeek);
        const count = allUsers.filter(function(row) {
          const createdAt = new Date(row[9]);
          return createdAt >= weekStart && createdAt < weekEnd;
        }).length;

        // Label: "Mar 10"
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const label = months[weekStart.getMonth()] + ' ' + weekStart.getDate();
        weeklyGrowth.push({ label: label, count: count });
      }

      // --- Last stamp activity per user ---
      const lastStampPerUser = {};
      allTx.filter(function(r) { return r[2] === 'add'; }).forEach(function(r) {
        const userId = String(r[1]);
        const ts = Number(r[4]);
        if (!lastStampPerUser[userId] || ts > lastStampPerUser[userId]) {
          lastStampPerUser[userId] = ts;
        }
      });

      // --- At-risk customers: no stamp activity in last 30 days ---
      const atRiskUsers = allUsers
        .filter(function(row) {
          const userId = String(row[0]);
          const lastStamp = lastStampPerUser[userId];
          if (!lastStamp) return true; // never received a stamp
          return new Date(lastStamp) < oneMonthAgo;
        })
        .map(function(row) {
          const userId = String(row[0]);
          const lastTs = lastStampPerUser[userId] || null;
          return {
            id: userId,
            name: row[1],
            phone: row[3],
            stamps: parseInt(row[7] || 0),
            lastStampAt: lastTs ? new Date(lastTs).toISOString() : null,
            daysSinceLastStamp: lastTs ? Math.floor((now.getTime() - lastTs) / msPerDay) : null
          };
        })
        .sort(function(a, b) {
          // Sort: never-stamped first, then longest inactive
          if (!a.lastStampAt && !b.lastStampAt) return 0;
          if (!a.lastStampAt) return -1;
          if (!b.lastStampAt) return 1;
          return (b.daysSinceLastStamp || 0) - (a.daysSinceLastStamp || 0);
        });

      // --- Active members breakdown: new (<1 month join) vs veteran (>1 month join) ---
      const activeUsers = allUsers.filter(function(row) {
        const userId = String(row[0]);
        const lastStamp = lastStampPerUser[userId];
        if (!lastStamp) return false;
        return new Date(lastStamp) >= oneMonthAgo;
      });
      const newActiveCount = activeUsers.filter(function(row) {
        return new Date(row[9]) >= oneMonthAgo;
      }).length;
      const veteranActiveCount = activeUsers.filter(function(row) {
        return new Date(row[9]) < oneMonthAgo;
      }).length;

      // --- Daily member registrations for last 56 days (8 weeks x 7 days) ---
      const dailyGrowth = [];
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 55; i >= 0; i--) {
        const dayEnd = new Date(now.getTime() - i * msPerDay);
        const dayStart = new Date(dayEnd.getTime() - msPerDay);
        const count = allUsers.filter(function(row) {
          const createdAt = new Date(row[9]);
          return createdAt >= dayStart && createdAt < dayEnd;
        }).length;
        dailyGrowth.push({
          date: months[dayStart.getMonth()] + ' ' + dayStart.getDate(),
          count: count
        });
      }

      // --- Cumulative member count per week ---
      const cumulativeGrowth = [];
      for (let i = 7; i >= 0; i--) {
        const weekEnd = new Date(now.getTime() - i * msPerWeek);
        const count = allUsers.filter(function(row) {
          return new Date(row[9]) < weekEnd;
        }).length;
        cumulativeGrowth.push({ label: weeklyGrowth[7 - i].label, count: count });
      }

      // --- Referral Performance ---
      // row[5] = referralCode (admin code used when registering)
      const referralCount = {};
      allUsers.forEach(function(row) {
        const code = String(row[5] || '').trim();
        if (code) {
          referralCount[code] = (referralCount[code] || 0) + 1;
        }
      });
      const referralLeaderboard = Object.keys(referralCount)
        .map(function(code) { return { code: code, count: referralCount[code] }; })
        .sort(function(a, b) { return b.count - a.count; })
        .slice(0, 10);

      const totalReferred = allUsers.filter(function(row) {
        return String(row[5] || '').trim() !== '';
      }).length;

      // Monthly referral count — starting from Feb 2026 (app launch)
      const mnthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const refAppStart = new Date(2026, 1, 1); // Feb 1, 2026
      const monthlyReferrals = [];
      const monthlyLeaderboards = {}; // { "Feb 26": [{code, count}, ...], ... }

      var cursor = new Date(refAppStart);
      while (cursor <= now) {
        var mStart = new Date(cursor);
        var mEnd   = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        var mLabel = mnthNames[mStart.getMonth()] + ' ' + String(mStart.getFullYear()).slice(2);

        // Count total referred this month
        var mCount = allUsers.filter(function(row) {
          var hasRef = String(row[5] || '').trim() !== '';
          var created = new Date(row[9]);
          return hasRef && created >= mStart && created < mEnd;
        }).length;
        monthlyReferrals.push({ label: mLabel, count: mCount });

        // Per-referral-code breakdown for this month
        var codeTally = {};
        allUsers.forEach(function(row) {
          var code = String(row[5] || '').trim();
          if (!code) return;
          var created = new Date(row[9]);
          if (created >= mStart && created < mEnd) {
            codeTally[code] = (codeTally[code] || 0) + 1;
          }
        });
        monthlyLeaderboards[mLabel] = Object.keys(codeTally)
          .map(function(c) { return { code: c, count: codeTally[c] }; })
          .sort(function(a, b) { return b.count - a.count; });

        cursor = mEnd; // advance to next month
      }

      // --- Birthday ---
      const todayMonth = now.getMonth() + 1; // 1-indexed
      const todayDay = now.getDate();

      var birthdayToday = [];
      var birthdayThisMonth = [];

      allUsers.forEach(function(row) {
        // Use formatDate() to handle cases where Google Sheets stores the value
        // as a Date object (auto-converted from a date string), which would produce
        // an unrecognizable format if coerced via String() directly.
        const rawBirth = formatDate(row[6]).trim();
        if (!rawBirth) return;

        // birthDate stored as YYYY-MM-DD or DD/MM/YYYY or similar
        var bMonth = null, bDay = null;
        // Try YYYY-MM-DD
        var isoMatch = rawBirth.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
          bMonth = parseInt(isoMatch[2]);
          bDay = parseInt(isoMatch[3]);
        } else {
          // Try DD/MM/YYYY or DD-MM-YYYY
          var dmyMatch = rawBirth.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            bDay = parseInt(dmyMatch[1]);
            bMonth = parseInt(dmyMatch[2]);
          }
        }

        if (!bMonth || !bDay) return;

        const person = {
          id: row[0],
          name: row[1],
          phone: row[3],
          birthDate: rawBirth,
          birthDay: bDay,
          birthMonth: bMonth
        };

        if (bMonth === todayMonth && bDay === todayDay) {
          birthdayToday.push(person);
        }
        if (bMonth === todayMonth) {
          birthdayThisMonth.push(person);
        }
      });

      // Sort this-month birthdays by day
      birthdayThisMonth.sort(function(a, b) { return a.birthDay - b.birthDay; });

      result = {
        success: true,
        data: {
          totalMembers: totalMembers,
          atRiskCount: atRiskUsers.length,
          newActiveCount: newActiveCount,
          veteranActiveCount: veteranActiveCount,
          weeklyGrowth: weeklyGrowth,
          dailyGrowth: dailyGrowth,
          cumulativeGrowth: cumulativeGrowth,
          atRiskUsers: atRiskUsers.slice(0, 50),
          referralLeaderboard: referralLeaderboard,
          totalReferred: totalReferred,
          monthlyReferrals: monthlyReferrals,
          monthlyLeaderboards: monthlyLeaderboards,
          birthdayToday: birthdayToday,
          birthdayThisMonth: birthdayThisMonth
        }
      };
    }

    // Get admin list
    else if (action === 'getAdminList') {
      const adminSheet = getOrCreateSheet(doc, 'AdminList', ['id', 'name', 'code']);
      const allRows = adminSheet.getDataRange().getValues().slice(1);
      const admins = allRows
        .filter(function(row) { return String(row[0]).trim() !== ''; })
        .map(function(row) {
          return {
            id: String(row[0]),
            name: String(row[1]),
            code: String(row[2])
          };
        });
      result = { success: true, admins: admins };
    }

    // Save admin list
    else if (action === 'saveAdminList') {
      const adminSheet = getOrCreateSheet(doc, 'AdminList', ['id', 'name', 'code']);
      const admins = requestData.admins || [];

      // Clear existing data (except header)
      if (adminSheet.getLastRow() > 1) {
        adminSheet.deleteRows(2, adminSheet.getLastRow() - 1);
      }

      // Append each admin
      admins.forEach(function(admin) {
        adminSheet.appendRow([
          admin.id || 'admin-' + new Date().getTime(),
          String(admin.name || '').trim(),
          String(admin.code || '').trim()
        ]);
      });
      SpreadsheetApp.flush();

      result = { success: true, admins: admins };
    }

    // Get admin list
    else if (action === 'getAdminList') {
      const adminSheet = getOrCreateSheet(doc, 'AdminList', ['id', 'name', 'code']);
      const allRows = adminSheet.getDataRange().getValues().slice(1);
      const admins = allRows
        .filter(function(row) { return String(row[0]).trim() !== ''; })
        .map(function(row) {
          return {
            id: String(row[0]),
            name: String(row[1]),
            code: String(row[2])
          };
        });
      result = { success: true, admins: admins };
    }

    // Save admin list
    else if (action === 'saveAdminList') {
      const adminSheet = getOrCreateSheet(doc, 'AdminList', ['id', 'name', 'code']);
      const admins = requestData.admins || [];

      // Clear existing data (except header)
      if (adminSheet.getLastRow() > 1) {
        adminSheet.deleteRows(2, adminSheet.getLastRow() - 1);
      }

      // Append each admin
      admins.forEach(function(admin) {
        adminSheet.appendRow([
          admin.id || 'admin-' + new Date().getTime(),
          String(admin.name || '').trim(),
          String(admin.code || '').trim()
        ]);
      });
      SpreadsheetApp.flush();

      result = { success: true, admins: admins };
    }

    // Reset stamps to 0 (after reward redemption)
    else if (action === 'resetStamps') {
      const userId = requestData.userId;
      const allUsers = usersSheet.getDataRange().getValues();
      const userIndex = allUsers.slice(1).findIndex(r => String(r[0]) === String(userId));

      if (userIndex === -1) {
        result = { success: false, error: "User not found." };
      } else {
        const realRow = userIndex + 2;
        usersSheet.getRange(realRow, 8).setValue(0); // reset currentStamps (col 8, 1-indexed)
        const now = new Date();
        txSheet.appendRow(['tx-' + now.getTime(), userId, 'reset', 0, now.getTime(), now.toISOString()]);
        SpreadsheetApp.flush();

        const updatedRow = [...allUsers[userIndex + 1]];
        updatedRow[7] = 0; // stamps index in row
        const history = getTransactionsForUser(txSheet, userId);
        result = { success: true, user: mapRowToUser(updatedRow, history) };
      }
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

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
      var y = val.getFullYear();
      var m = ('0' + (val.getMonth() + 1)).slice(-2);
      var d = ('0' + val.getDate()).slice(-2);
      return y + '-' + m + '-' + d;
  }
  return String(val).trim();
}

function getOrCreateSheet(doc, name, headers) {
  let sheet = doc.getSheetByName(name);
  if (!sheet) {
    sheet = doc.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    
    // NEW: Initialize CheckpointConfig with default data
    if (name === 'CheckpointConfig') {
      sheet.appendRow([
        10,
        JSON.stringify([
          { stampCount: 3, reward: 'Free iced tea' },
          { stampCount: 5, reward: 'Free drink upgrade' },
          { stampCount: 10, reward: 'Free beverage' }
        ])
      ]);
    }
    // AdminList starts empty — admins are added via the admin panel
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
    name: row[1],
    email: row[2],
    phone: row[3],
    address: row[4],
    referralCode: row[5] || '',      // NEW: Admin referral code
    birthDate: formatDate(row[6]),   // shifted from 5 -> 6
    stamps: parseInt(row[7] || 0),   // shifted from 6 -> 7
    maxStamps: parseInt(row[8] || 10), // shifted from 7 -> 8
    createdAt: row[9] || new Date().toISOString(), // shifted from 8 -> 9
    history: history
  };
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ========== VOUCHER HELPER FUNCTIONS ==========

/**
 * Check if a stamp count is a checkpoint
 */
function checkIfCheckpoint(stampCount, checkpointConfig) {
  if (!checkpointConfig || !checkpointConfig.checkpoints) return null;
  const checkpoint = checkpointConfig.checkpoints.find(cp => cp.stampCount === stampCount);
  return checkpoint || null;
}

/**
 * Generate a voucher for a user when they reach a checkpoint
 */
function generateVoucher(doc, userId, stampCount, rewardName) {
  const vouchersSheet = getOrCreateSheet(doc, 'Vouchers', [
    'id', 'userId', 'checkpointStampCount', 'rewardName', 'createdAt', 'expiresAt', 'redeemedAt', 'status'
  ]);
  
  const now = new Date();
  const expiresAt = calculateExpiryDate(now, 30); // 30 days expiry
  const voucherId = 'voucher-' + now.getTime() + '-' + Math.random().toString(36).substr(2, 9);
  
  const voucherRow = [
    voucherId,
    userId,
    stampCount,
    rewardName,
    now.toISOString(),
    expiresAt.toISOString(),
    '', // redeemedAt - empty initially
    'active'
  ];
  
  vouchersSheet.appendRow(voucherRow);
  
  // Log transaction
  const txSheet = getOrCreateSheet(doc, 'Transactions', [
    'id', 'userId', 'type', 'amount', 'timestamp', 'dateString'
  ]);
  txSheet.appendRow([
    'tx-' + now.getTime(),
    userId,
    'voucher_earned',
    1,
    now.getTime(),
    now.toISOString()
  ]);
  
  SpreadsheetApp.flush();
  
  return {
    id: voucherId,
    userId: userId,
    checkpointStampCount: stampCount,
    rewardName: rewardName,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    redeemedAt: null,
    status: 'active'
  };
}

/**
 * Calculate expiry date (default 30 days from now)
 */
function calculateExpiryDate(fromDate, days) {
  const expiry = new Date(fromDate);
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Get checkpoint configuration
 */
function getCheckpointConfiguration(doc) {
  const configSheet = getOrCreateSheet(doc, 'CheckpointConfig', ['maxStamps', 'checkpoints']);
  const data = configSheet.getDataRange().getValues();
  
  if (data.length < 2) {
    return {
      maxStamps: 10,
      checkpoints: [
        { stampCount: 3, reward: 'Free Lychee Tea' },
        { stampCount: 5, reward: 'diskon 15% off game' },
        { stampCount: 7, reward: 'Free french fries' },
        { stampCount: 10, reward: 'Free all day pass' }
      ]
    };
  }
  
  const maxStamps = parseInt(data[1][0]) || 10;
  let checkpoints = [];
  try {
    checkpoints = JSON.parse(data[1][1] || '[]');
  } catch (e) {
    checkpoints = [];
  }
  
  return { maxStamps, checkpoints };
}
