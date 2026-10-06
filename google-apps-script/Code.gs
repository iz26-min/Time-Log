/**
 * Time Tracker — Google Apps Script backend
 * Deploy as Web App (Execute as: Me, Who has access: Anyone)
 */

var TZ = 'Asia/Hong_Kong';
var SHEET_NAME = 'TimeLog';

var SPREADSHEET_ID = '1vV6zhBQaYurRieIWkXmUumxRaaJwwUQdIcWRIOSPVdE';

/** Columns stored in the sheet (no Id / Created / Updated). */
var HEADERS = [
  'Date',
  'Task',
  'Start At',
  'End At',
  'Duration Minutes',
  'Notes',
];

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (!params.action) {
    params.action = 'getTodayState';
  }
  return handleRequest_(params);
}

function doPost(e) {
  var params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      return jsonResponse_({ ok: false, error: 'Invalid JSON body' });
    }
  }
  return handleRequest_(params);
}

function handleRequest_(params) {
  try {
    var action = params.action;
    if (!action) {
      return jsonResponse_({ ok: false, error: 'Missing action' });
    }

    var sheet = getSheet_();
    ensureHeaders_(sheet);

    var result;
    switch (action) {
      case 'getTodayState':
        result = getTodayState_(sheet);
        break;
      case 'startActivity':
        result = startActivity_(sheet, params);
        break;
      case 'finishActivity':
        result = finishActivity_(sheet, params);
        break;
      case 'addCompleteActivity':
        result = addCompleteActivity_(sheet, params);
        break;
      default:
        return jsonResponse_({ ok: false, error: 'Unknown action: ' + action });
    }

    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'Set SPREADSHEET_ID at top of Code.gs to your Sheet ID from the URL.',
    );
  }
  return ss;
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }
  var firstCell = String(sheet.getRange(1, 1).getValue() || '').trim();
  if (firstCell !== 'Date' && firstCell !== 'Id') {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function buildColMap_(sheet) {
  var lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var name = String(headerRow[c] || '').trim();
    if (name) map[name] = c + 1;
  }
  return map;
}

function col_(map, name) {
  var idx = map[name];
  if (!idx) throw new Error('Missing column in sheet: ' + name);
  return idx;
}

function readAllRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var colMap = buildColMap_(sheet);
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow, lastCol).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var sheetRow = i + 2;
    var entry = rowToEntry_(values[i], sheetRow, colMap);
    if (entry) rows.push(entry);
  }
  return rows;
}

function cell_(row, colMap, name) {
  var idx = col_(colMap, name) - 1;
  return row[idx];
}

function rowToEntry_(row, sheetRow, colMap) {
  var task = String(cell_(row, colMap, 'Task') || '').trim();
  var startRaw = cell_(row, colMap, 'Start At');
  if (!task && !startRaw) return null;

  var endRaw = cell_(row, colMap, 'End At');
  var durRaw = cell_(row, colMap, 'Duration Minutes');

  return {
    id: 'row:' + sheetRow,
    date: formatDateCell_(cell_(row, colMap, 'Date')),
    task: task,
    startAt: formatDateTimeCell_(startRaw),
    endAt: endRaw ? formatDateTimeCell_(endRaw) : null,
    durationMinutes: durRaw === '' || durRaw === null ? null : Number(durRaw),
    notes: String(cell_(row, colMap, 'Notes') || ''),
  };
}

function formatDateCell_(cell) {
  if (cell instanceof Date) {
    return Utilities.formatDate(cell, TZ, 'yyyy-MM-dd');
  }
  return String(cell || '');
}

function formatDateTimeCell_(cell) {
  if (cell instanceof Date) {
    return toHKISOString_(cell);
  }
  var s = String(cell || '').trim();
  if (!s) return '';
  return s;
}

function toHKISOString_(date) {
  return Utilities.formatDate(date, TZ, "yyyy-MM-dd'T'HH:mm:ss") + '+08:00';
}

function parseISOToDate_(iso) {
  if (!iso) throw new Error('Missing datetime');
  var d = new Date(iso);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid datetime: ' + iso);
  }
  return d;
}

function hkCalendarDate_(date) {
  return Utilities.formatDate(date, TZ, 'yyyy-MM-dd');
}

function durationMinutes_(start, end) {
  var startMs = start.getTime();
  var endMs = end.getTime();
  if (endMs < startMs) {
    endMs += 24 * 60 * 60 * 1000;
  }
  return Math.round((endMs - startMs) / 60000);
}

function nowHK_() {
  return new Date();
}

function parseRowId_(id) {
  if (!id) return -1;
  var s = String(id);
  if (s.indexOf('row:') === 0) {
    return parseInt(s.slice(4), 10);
  }
  return -1;
}

function findRowByEntryId_(sheet, entryId) {
  var row = parseRowId_(entryId);
  if (row >= 2 && row <= sheet.getLastRow()) return row;
  return -1;
}

function getActiveEntries_(rows, today) {
  var active = rows.filter(function (r) {
    return r.date === today && !r.endAt;
  });
  active.sort(function (a, b) {
    return a.startAt < b.startAt ? 1 : -1;
  });
  return active;
}

function normalizeHint_(hint) {
  return String(hint || '')
    .trim()
    .toLowerCase()
    .replace(/^任务/, '');
}

function tasksMatch_(task, hint) {
  var t = String(task || '')
    .trim()
    .toLowerCase();
  var h = normalizeHint_(hint);
  if (!h) return false;
  if (t === h) return true;
  var tStripped = t.replace(/^任务/, '');
  if (tStripped === h) return true;
  if (t.indexOf(h) >= 0 || h.indexOf(t) >= 0) return true;
  if (tStripped.indexOf(h) >= 0 || h.indexOf(tStripped) >= 0) return true;
  return false;
}

function pickActiveToFinish_(rows, today, taskHint, id) {
  var actives = getActiveEntries_(rows, today);
  if (actives.length === 0) return null;

  if (id) {
    for (var i = 0; i < actives.length; i++) {
      if (actives[i].id === id) return actives[i];
    }
    throw new Error('Activity not found');
  }

  if (taskHint) {
    for (var j = 0; j < actives.length; j++) {
      if (tasksMatch_(actives[j].task, taskHint)) return actives[j];
    }
    throw new Error(
      'No active activity matching "' +
        taskHint +
        '". Open: ' +
        actives.map(function (a) {
          return a.task;
        }).join(', '),
    );
  }

  return actives[0];
}

function getTodayState_(sheet) {
  var today = hkCalendarDate_(nowHK_());
  var rows = readAllRows_(sheet);
  var todayRows = rows.filter(function (r) {
    return r.date === today;
  });
  todayRows.sort(function (a, b) {
    return a.startAt < b.startAt ? 1 : -1;
  });

  var actives = getActiveEntries_(rows, today);

  return {
    today: today,
    timezone: TZ,
    active: actives.length ? actives[0] : null,
    actives: actives,
    entries: todayRows,
  };
}

function startActivity_(sheet, params) {
  var task = String(params.task || '').trim();
  if (!task) throw new Error('Task is required');

  var startAt = parseISOToDate_(params.startAt);
  var today = hkCalendarDate_(startAt);

  if (params.finishPreviousId) {
    finishActivity_(sheet, {
      id: params.finishPreviousId,
      endAt: toHKISOString_(startAt),
    });
  }

  sheet.appendRow([today, task, startAt, '', '', '']);

  return getTodayState_(sheet);
}

function finishActivity_(sheet, params) {
  var endAt = parseISOToDate_(params.endAt);
  var today = hkCalendarDate_(endAt);
  var colMap = buildColMap_(sheet);

  var rows = readAllRows_(sheet);
  var target = pickActiveToFinish_(
    rows,
    today,
    params.taskHint,
    params.id,
  );
  if (!target) throw new Error('No active activity to finish');
  var rowIndex = findRowByEntryId_(sheet, target.id);
  if (rowIndex < 0) throw new Error('Activity not found');

  var startCell = sheet.getRange(rowIndex, col_(colMap, 'Start At')).getValue();
  var startAt =
    startCell instanceof Date ? startCell : parseISOToDate_(String(startCell));
  var mins = durationMinutes_(startAt, endAt);

  sheet.getRange(rowIndex, col_(colMap, 'End At')).setValue(endAt);
  sheet.getRange(rowIndex, col_(colMap, 'Duration Minutes')).setValue(mins);

  return getTodayState_(sheet);
}

function addCompleteActivity_(sheet, params) {
  var task = String(params.task || '').trim();
  if (!task) throw new Error('Task is required');

  var startAt = parseISOToDate_(params.startAt);
  var endAt = parseISOToDate_(params.endAt);
  var mins = durationMinutes_(startAt, endAt);
  if (mins <= 0) {
    throw new Error('End time must be after start time');
  }

  var today = hkCalendarDate_(startAt);

  sheet.appendRow([today, task, startAt, endAt, mins, '']);

  return getTodayState_(sheet);
}
