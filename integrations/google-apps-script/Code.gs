/**
 * Minapp – henter uleste e-poster og nyheter til dashboardet «Min dag».
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

function doGet(e) {
  var key = PropertiesService.getScriptProperties().getProperty('KEY')
  if (!key || !e || !e.parameter || e.parameter.key !== key) return json_({ error: 'Ingen tilgang' })

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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

/** Kjør denne én gang fra editoren for å gi tillatelse til Gmail og nett før du publiserer. */
function test() {
  Logger.log(JSON.stringify({ unread: GmailApp.getInboxUnreadCount(), mails: getMails_().length, news: getNews_().length }))
}
