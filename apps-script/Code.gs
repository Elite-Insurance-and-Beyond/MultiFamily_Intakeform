/**
 * Elite Insurance & Beyond — commercial property quote intake.
 *
 * Deployed as a Google Apps Script Web App bound to a Google Sheet.
 * The landing page POSTs JSON here; this appends a row and emails a
 * formatted summary to the quote desk.
 *
 * Deploy: Deploy > New deployment > Web app
 *   Execute as:      Me (the account that should send the email)
 *   Who has access:  Anyone
 * Then copy the /exec URL into ENDPOINT in index.html.
 */

var CONFIG = {
  SHEET_NAME: 'Leads',
  NOTIFY_TO: 'quote@insbeyond.com',
  NOTIFY_CC: '',                       // e.g. 'info@insbeyond.com'
  FROM_NAME: 'Elite Insurance & Beyond',
  SUBJECT_PREFIX: 'Property quote request',
  PHONE: '305-877-1017',
  BRAND_URL: 'https://insbeyond.com',
  LOGO_URL: '',                        // optional absolute URL to the crest PNG
  MIN_ELAPSED_MS: 3000,                // faster than this is almost certainly a bot
  SEND_LEAD_RECEIPT: false             // set true to also confirm to the lead
};

/** Field order drives both the sheet columns and the email rows. */
var FIELDS = [
  { key: 'taken_by',          label: 'Taken by',          required: true, emailSkip: true },
  { key: 'first_name',        label: 'First name',        required: true, emailSkip: true },
  { key: 'last_name',         label: 'Last name',         required: true, emailSkip: true },
  { key: 'phone',             label: 'Phone',             required: true },
  { key: 'email',             label: 'Email',             required: true },
  { key: 'property_address',  label: 'Property address',  required: true, emailSkip: true },
  { key: 'unit_count',        label: 'Number of units',   required: true },
  { key: 'occupancy',         label: 'Occupancy',         required: true },
  { key: 'has_mortgage',      label: 'Has mortgage' },
  { key: 'loan_amount',       label: 'Current loan amount', money: true },
  { key: 'currently_insured', label: 'Currently insured' },
  { key: 'current_carrier',   label: 'Current carrier' },
  { key: 'renewal_date',      label: 'Renewal date',      date: true },
  { key: 'goal',              label: 'Looking for',       required: true },
  { key: 'additional_info',   label: 'Additional information' }
];

var BRAND = {
  navy:  '#274057',
  amber: '#F7AD40',
  ink:   '#101A24',
  slate: '#5A6B7C',
  mist:  '#EEF1F5',
  rule:  '#D8DEE6',
  font:  "Helvetica Neue, Helvetica, Arial, sans-serif"
};

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, service: 'eib-quote-intake', ts: new Date().toISOString() });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    var data = parseBody_(e);

    // Honeypot and speed trap. Return ok so bots learn nothing.
    if (data.company_website) return json_({ ok: true, ref: 'ignored' });
    if (Number(data.elapsed_ms) > 0 && Number(data.elapsed_ms) < CONFIG.MIN_ELAPSED_MS) {
      return json_({ ok: true, ref: 'ignored' });
    }

    var missing = FIELDS
      .filter(function (f) { return f.required && !String(data[f.key] || '').trim(); })
      .map(function (f) { return f.label; });
    if (missing.length) {
      return json_({ ok: false, error: 'Missing: ' + missing.join(', ') });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      return json_({ ok: false, error: 'That email address does not look right.' });
    }

    var sheet = getSheet_();
    var row = sheet.getLastRow() + 1;
    var now = new Date();
    var ref = 'EIB-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyMMdd') +
              '-' + ('000' + (row - 1)).slice(-4);

    sheet.appendRow(
      [now, ref].concat(
        FIELDS.map(function (f) { return String(data[f.key] || ''); })
      ).concat([String(data.page_url || ''), String(data.elapsed_ms || '')])
    );

    sendNotification_(data, ref, now);
    if (CONFIG.SEND_LEAD_RECEIPT) sendReceipt_(data, ref);

    return json_({ ok: true, ref: ref });

  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (ignore) {}
  }
  return (e && e.parameter) ? e.parameter : {};
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    var header = ['Received', 'Reference']
      .concat(FIELDS.map(function (f) { return f.label; }))
      .concat(['Page URL', 'Time on page (ms)']);
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length)
      .setFontWeight('bold')
      .setBackground(BRAND.navy)
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function fmt_(field, value) {
  var v = String(value || '').trim();
  if (!v) return '';
  if (field.money) return '$' + Number(v.replace(/[^0-9.]/g, '')).toLocaleString('en-US');
  if (field.date) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      var MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
      return MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
    }
  }
  return v;
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendNotification_(data, ref, now) {
  var name = (data.first_name + ' ' + data.last_name).trim();
  var subject = CONFIG.SUBJECT_PREFIX + ': ' + name + ' — ' + (data.property_address || '');

  MailApp.sendEmail({
    to: CONFIG.NOTIFY_TO,
    cc: CONFIG.NOTIFY_CC || undefined,
    replyTo: data.email,
    name: CONFIG.FROM_NAME,
    subject: subject.slice(0, 200),
    htmlBody: buildHtml_(data, ref, now),
    body: buildText_(data, ref, now)
  });
}

function sendReceipt_(data, ref) {
  MailApp.sendEmail({
    to: data.email,
    name: CONFIG.FROM_NAME,
    replyTo: CONFIG.NOTIFY_TO,
    subject: 'We have your quote request (' + ref + ')',
    body: 'Thanks ' + data.first_name + ',\n\n' +
          'We received your request for ' + data.property_address + '.\n' +
          'A licensed agent will be in touch, usually the same business day.\n\n' +
          'Your reference is ' + ref + '. Need it sooner? Call ' + CONFIG.PHONE + '.\n\n' +
          CONFIG.FROM_NAME + '\n' + CONFIG.BRAND_URL
  });
}

function buildHtml_(data, ref, now) {
  var name = esc_((data.first_name + ' ' + data.last_name).trim());
  var stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "EEEE, MMMM d, yyyy 'at' h:mm a");

  var rows = FIELDS.filter(function (f) {
    return f.key !== 'additional_info' && !f.emailSkip && fmt_(f, data[f.key]);
  }).map(function (f, i) {
    var bg = i % 2 ? '#FFFFFF' : BRAND.mist;
    return '' +
      '<tr>' +
        '<td style="background:' + bg + ';padding:12px 16px;border-bottom:1px solid ' + BRAND.rule + ';' +
            'font:600 12px/1.4 ' + BRAND.font + ';letter-spacing:.08em;text-transform:uppercase;' +
            'color:' + BRAND.navy + ';white-space:nowrap;vertical-align:top;">' + esc_(f.label) + '</td>' +
        '<td style="background:' + bg + ';padding:12px 16px;border-bottom:1px solid ' + BRAND.rule + ';' +
            'font:400 16px/1.5 ' + BRAND.font + ';color:' + BRAND.ink + ';">' + esc_(fmt_(f, data[f.key])) + '</td>' +
      '</tr>';
  }).join('');

  var notes = String(data.additional_info || '').trim();
  var notesBlock = notes ? '' +
    '<tr><td colspan="2" style="padding:24px 16px 0;">' +
      '<div style="font:600 12px/1.4 ' + BRAND.font + ';letter-spacing:.08em;text-transform:uppercase;color:' + BRAND.slate + ';">Additional information</div>' +
      '<div style="border-left:3px solid ' + BRAND.amber + ';padding:4px 0 4px 16px;margin-top:10px;' +
           'font:400 16px/1.6 ' + BRAND.font + ';color:' + BRAND.ink + ';white-space:pre-wrap;">' + esc_(notes) + '</div>' +
    '</td></tr>' : '';

  var mark = CONFIG.LOGO_URL
    ? '<img src="' + esc_(CONFIG.LOGO_URL) + '" width="44" alt="" style="display:block;border:0;">'
    : '';

  return '' +
'<!doctype html><html><body style="margin:0;padding:0;background:' + BRAND.mist + ';">' +
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + BRAND.mist + ';padding:24px 12px;">' +
'<tr><td align="center">' +
'<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#FFFFFF;">' +

  '<tr><td style="background:' + BRAND.navy + ';padding:20px 24px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      (mark ? '<td style="padding-right:14px;">' + mark + '</td>' : '') +
      '<td style="font:600 13px/1.4 ' + BRAND.font + ';letter-spacing:.1em;text-transform:uppercase;color:#FFFFFF;">' +
        'Elite Insurance &amp; Beyond</td>' +
    '</tr></table>' +
  '</td></tr>' +
  '<tr><td style="background:' + BRAND.amber + ';height:5px;line-height:5px;font-size:0;">&nbsp;</td></tr>' +

  '<tr><td style="padding:32px 24px 0;">' +
    '<div style="font:600 12px/1.4 ' + BRAND.font + ';letter-spacing:.1em;text-transform:uppercase;color:' + BRAND.slate + ';">New quote request</div>' +
    '<div style="font:700 30px/1.15 ' + BRAND.font + ';letter-spacing:-.02em;color:' + BRAND.ink + ';margin-top:10px;">' + name + '</div>' +
    '<div style="font:400 17px/1.5 ' + BRAND.font + ';color:' + BRAND.slate + ';margin-top:8px;">' + esc_(data.property_address || '') + '</div>' +
  '</td></tr>' +

  '<tr><td style="padding:22px 24px 0;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="background:' + BRAND.amber + ';">' +
        '<a href="tel:' + esc_(String(data.phone).replace(/[^0-9+]/g, '')) + '" ' +
           'style="display:inline-block;padding:13px 22px;font:600 15px/1 ' + BRAND.font + ';color:' + BRAND.ink + ';text-decoration:none;">' +
           'Call ' + esc_(data.phone) + '</a></td>' +
      '<td style="width:12px;">&nbsp;</td>' +
      '<td style="border:1px solid ' + BRAND.navy + ';">' +
        '<a href="mailto:' + esc_(data.email) + '" ' +
           'style="display:inline-block;padding:12px 22px;font:600 15px/1 ' + BRAND.font + ';color:' + BRAND.navy + ';text-decoration:none;">' +
           'Email the lead</a></td>' +
    '</tr></table>' +
  '</td></tr>' +

  '<tr><td style="padding:28px 24px 0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ' + BRAND.rule + ';">' +
      rows + notesBlock +
    '</table>' +
  '</td></tr>' +

  '<tr><td style="padding:28px 24px 32px;">' +
    '<div style="border-top:1px solid ' + BRAND.rule + ';padding-top:16px;font:400 13px/1.6 ' + BRAND.font + ';color:' + BRAND.slate + ';">' +
      'Reference <strong style="color:' + BRAND.ink + ';">' + esc_(ref) + '</strong><br>' +
      'Taken by ' + esc_(data.taken_by || 'unknown') + ' &middot; ' + esc_(stamp) + '<br>' +
      'Reply to this email to answer ' + esc_(data.first_name) + ' directly.' +
    '</div>' +
  '</td></tr>' +

'</table></td></tr></table></body></html>';
}

function buildText_(data, ref, now) {
  var lines = ['NEW QUOTE REQUEST — ' + ref, ''];
  FIELDS.forEach(function (f) {
    var v = fmt_(f, data[f.key]);
    if (v) lines.push(f.label + ': ' + v);
  });
  lines.push('', 'Received: ' + now.toString(), 'Source: ' + (data.page_url || 'n/a'));
  return lines.join('\n');
}
