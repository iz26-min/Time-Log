/**
 * Time Tracker — Google Apps Script backend
 * Deploy as Web App (Execute as: Me, Who has access: Anyone)
 */

var TZ = 'Asia/Hong_Kong';
var SHEET_NAME = 'TimeLog';
var HEADERS = [
  'Id',
  'Date',
  'Task',
  'Start At',
  'End At',
  'Duration Minutes',
  'Notes',
  'Created At',
  'Updated At',
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

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error(
      'No active spreadsheet. Bind this script to your Google Sheet (Extensions → Apps Script).',
    );
  }
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
  var firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  var needsHeader = firstRow[0] !== 'Id';
  if (needsHeader) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function colIndex_(name) {
  return HEADERS.indexOf(name) + 1;
}

function readAllRows_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow, HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var row = rowToEntry_(values[i]);
    if (row) rows.push(row);
  }
  return rows;
}

function rowToEntry_(row) {
  var id = String(row[0] || '').trim();
  if (!id) return null;

  return {
    id: id,
    date: formatDateCell_(row[1]),
    task: String(row[2] || ''),
    startAt: formatDateTimeCell_(row[3]),
    endAt: row[4] ? formatDateTimeCell_(row[4]) : null,
    durationMinutes: row[5] === '' || row[5] === null ? null : Number(row[5]),
    notes: String(row[6] || ''),
    createdAt: formatDateTimeCell_(row[7]),
    updatedAt: formatDateTimeCell_(row[8]),
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

function uuid_() {
  return Utilities.getUuid();
}

function nowHK_() {
  return new Date();
}

function findRowById_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) return i + 2;
  }
  return -1;
}

function getActiveEntry_(rows, today) {
  var active = rows.filter(function (r) {
    return r.date === today && !r.endAt;
  });
  if (active.length === 0) return null;
  active.sort(function (a, b) {
    return a.startAt < b.startAt ? 1 : -1;
  });
  return active[0];
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

  return {
    today: today,
    timezone: TZ,
    active: getActiveEntry_(rows, today),
    entries: todayRows,
  };
}

function startActivity_(sheet, params) {
  var task = String(params.task || '').trim();
  if (!task) throw new Error('Task is required');

  var startAt = parseISOToDate_(params.startAt);
  var today = hkCalendarDate_(startAt);
  var now = nowHK_();

  if (params.finishPreviousId) {
    finishActivity_(sheet, {
      id: params.finishPreviousId,
      endAt: toHKISOString_(startAt),
    });
  } else {
    var rows = readAllRows_(sheet);
    var existing = getActiveEntry_(rows, today);
    if (existing) {
      throw new Error(
        'ACTIVE_CONFLICT:' +
          JSON.stringify({ active: existing, task: task, startAt: params.startAt }),
      );
    }
  }

  var id = uuid_();
  var isoStart = toHKISOString_(startAt);
  var row = [
    id,
    today,
    task,
    startAt,
    '',
    '',
    '',
    now,
    now,
  ];
  sheet.appendRow(row);

  return getTodayState_(sheet);
}

function finishActivity_(sheet, params) {
  var endAt = parseISOToDate_(params.endAt);
  var today = hkCalendarDate_(endAt);

  var rowIndex = -1;
  if (params.id) {
    rowIndex = findRowById_(sheet, params.id);
    if (rowIndex < 0) throw new Error('Activity not found');
  } else {
    var rows = readAllRows_(sheet);
    var active = getActiveEntry_(rows, today);
    if (!active) throw new Error('No active activity to finish');
    rowIndex = findRowById_(sheet, active.id);
  }

  var startCell = sheet.getRange(rowIndex, colIndex_('Start At')).getValue();
  var startAt =
    startCell instanceof Date ? startCell : parseISOToDate_(String(startCell));
  var mins = durationMinutes_(startAt, endAt);

  sheet.getRange(rowIndex, colIndex_('End At')).setValue(endAt);
  sheet.getRange(rowIndex, colIndex_('Duration Minutes')).setValue(mins);
  sheet.getRange(rowIndex, colIndex_('Updated At')).setValue(nowHK_());

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
  var now = nowHK_();
  var id = uuid_();

  sheet.appendRow([
    id,
    today,
    task,
    startAt,
    endAt,
    mins,
    '',
    now,
    now,
  ]);

  return getTodayState_(sheet);
}
