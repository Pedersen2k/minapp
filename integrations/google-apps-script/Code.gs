/**
 * Minapp – henter uleste e-poster og nyheter til dashboardet «Min dag»,
 * og lagrer sikkerhetskopier av oppgaver og sider i Google Drive.
 *
 * Kjører på din egen Google-konto (som deg), så ingen egen innlogging trengs i appen.
 * Sender bare avsender, emne og et kort utdrag – aldri hele e-poster – og bare til den
 * som kjenner nøkkelen (Prosjektinnstillinger → Skriptegenskaper → KEY).
 *
 * Oppsett: se instruksjonene i appen under Min dag → «Koble til Gmail».
 */

var MAIL_QUERY = 'is:unread in:inbox'
var MAIL_COUNT = 8
var NEWS_FEEDS = [
  { source: 'NRK', url: 'https://www.nrk.no/toppsaker.rss' },
  { source: 'NRK Møre og Romsdal', url: 'https://www.nrk.no/mr/toppsaker.rss' },
]
var NEWS_COUNT = 8
var BACKUP_FOLDER = 'Minapp sikkerhetskopier'
var BACKUP_KEEP = 30 // så mange dager med kopier beholdes; eldre legges i papirkurven i Drive

function hasKey_(given) {
  var key = PropertiesService.getScriptProperties().getProperty('KEY')
  return !!key && given === key
}

function doGet(e) {
  if (!e || !e.parameter || !hasKey_(e.parameter.key)) return json_({ error: 'Ingen tilgang' })

  if (e.parameter.action === 'backups') {
    try {
      return json_({ backups: listBackups_() })
    } catch (err) {
      return json_({ error: String(err) })
    }
  }
  if (e.parameter.action === 'backup') {
    try {
      return json_({ backup: JSON.parse(backupFile_(e.parameter.id).getBlob().getDataAsString()) })
    } catch (err) {
      return json_({ error: String(err) })
    }
  }

  var out = { updated: new Date().toISOString() }
  try {
    out.unread = GmailApp.getInboxUnreadCount()
    out.mails = getMails_()
  } catch (err) {
    out.mailError = String(err)
  }
  try {
    out.news = getNews_()
  } catch (err) {
    out.newsError = String(err)
  }
  return json_(out)
}

function getMails_() {
  return GmailApp.search(MAIL_QUERY, 0, MAIL_COUNT).map(function (thread) {
    var messages = thread.getMessages()
    var unread = messages.filter(function (m) { return m.isUnread() })
    var m = unread.length ? unread[unread.length - 1] : messages[messages.length - 1]
    var from = m.getFrom()
    var name = from.replace(/<.*>/, '').replace(/"/g, '').trim() || from
    return {
      id: thread.getId(),
      from: name,
      subject: m.getSubject() || '(uten emne)',
      snippet: m.getPlainBody().replace(/\s+/g, ' ').trim().slice(0, 160),
      date: m.getDate().toISOString(),
      url: 'https://mail.google.com/mail/u/0/#inbox/' + thread.getId(),
    }
  })
}

function getNews_() {
  var cache = CacheService.getScriptCache()
  var hit = cache.get('news')
  if (hit) return JSON.parse(hit)

  var media = XmlService.getNamespace('media', 'http://search.yahoo.com/mrss/')
  var items = []
  NEWS_FEEDS.forEach(function (feed) {
    var res = UrlFetchApp.fetch(feed.url, { muteHttpExceptions: true })
    if (res.getResponseCode() !== 200) return
    var channel = XmlService.parse(res.getContentText()).getRootElement().getChild('channel')
    channel.getChildren('item').forEach(function (item) {
      var image = item.getChild('content', media)
      var url = image && image.getAttribute('url')
      items.push({
        source: feed.source,
        title: item.getChildText('title'),
        link: item.getChildText('link'),
        summary: (item.getChildText('description') || '').replace(/<[^>]+>/g, '').trim().slice(0, 200),
        date: new Date(item.getChildText('pubDate')).toISOString(),
        image: url ? url.getValue() : null,
      })
    })
  })

  // Nyeste først, uten dubletter (samme sak kan stå i flere strømmer).
  var seen = {}
  items = items
    .sort(function (a, b) { return b.date < a.date ? -1 : 1 })
    .filter(function (n) {
      if (seen[n.link]) return false
      seen[n.link] = true
      return true
    })
    .slice(0, NEWS_COUNT)

  cache.put('news', JSON.stringify(items), 600) // 10 minutter
  return items
}

/** Tar imot en sikkerhetskopi fra appen: { key, backup }. Én fil per dag; samme dag overskrives. */
function doPost(e) {
  var body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return json_({ error: 'Ugyldig innhold' })
  }
  if (!hasKey_(body.key)) return json_({ error: 'Ingen tilgang' })
  if (!body.backup || body.backup.app !== 'minapp') return json_({ error: 'Mangler sikkerhetskopi' })

  try {
    var folder = backupFolder_()
    var day = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')
    var name = 'minapp-' + day + '.json'
    var content = JSON.stringify(body.backup)
    var existing = folder.getFilesByName(name)
    var file = existing.hasNext() ? existing.next() : null
    if (file) file.setContent(content)
    else file = folder.createFile(name, content, MimeType.PLAIN_TEXT)

    // Rydd: behold bare de nyeste kopiene.
    listBackups_().slice(BACKUP_KEEP).forEach(function (b) {
      DriveApp.getFileById(b.id).setTrashed(true)
    })
    return json_({ ok: true, id: file.getId(), name: name, savedAt: new Date().toISOString() })
  } catch (err) {
    return json_({ error: String(err) })
  }
}

function backupFolder_() {
  var folders = DriveApp.getFoldersByName(BACKUP_FOLDER)
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER)
}

function listBackups_() {
  var out = []
  var files = backupFolder_().getFiles()
  while (files.hasNext()) {
    var f = files.next()
    if (!/^minapp-.*\.json$/.test(f.getName())) continue
    out.push({ id: f.getId(), name: f.getName(), updated: f.getLastUpdated().toISOString(), size: f.getSize(), url: f.getUrl() })
  }
  return out.sort(function (a, b) { return b.updated < a.updated ? -1 : 1 })
}

/** Henter bare filer fra sikkerhetskopimappen, aldri andre filer i Drive. */
function backupFile_(id) {
  var file = DriveApp.getFileById(id)
  var parents = file.getParents()
  var folderId = backupFolder_().getId()
  while (parents.hasNext()) if (parents.next().getId() === folderId) return file
  throw new Error('Fant ikke sikkerhetskopien')
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

/** Kjør denne én gang fra editoren for å gi tillatelse til Gmail, Drive og nett før du publiserer. */
function test() {
  Logger.log(JSON.stringify({ unread: GmailApp.getInboxUnreadCount(), mails: getMails_().length, news: getNews_().length, backups: listBackups_().length }))
}
