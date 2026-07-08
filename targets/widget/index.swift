import WidgetKit
import SwiftUI

// アプリ本体(WebView)から App Group の UserDefaults に保存された「今日の状態」を表示する
// データは App.js が key "today" に JSON 文字列で書き込む

private let appGroup = "group.com.kozaburookuda.adhdo"

// MARK: - データモデル

struct DayData: Decodable {
  var date: String?
  var pct: Int?
  var done: Int?
  var total: Int?
  var events: [Ev]
}

struct Ev: Decodable {
  var title: String
  var icon: String?
  var hex: String?
  var start: Int   // 0時からの分
  var end: Int     // end < start は日をまたぐ(睡眠など)
  var done: Int?
}

extension Ev {
  var color: Color { Color(hex: hex ?? "#7bc5ba") }
  func contains(_ minute: Int) -> Bool {
    if start == end { return false }
    if start < end { return minute >= start && minute < end }
    return minute >= start || minute < end // 日またぎ
  }
  func minutesUntilStart(from minute: Int) -> Int { ((start - minute) % 1440 + 1440) % 1440 }
  func minutesUntilEnd(from minute: Int) -> Int { ((end - minute) % 1440 + 1440) % 1440 }
  var duration: Int { ((end - start) % 1440 + 1440) % 1440 }
}

func fmt(_ m: Int) -> String {
  let mm = ((m % 1440) + 1440) % 1440
  return String(format: "%d:%02d", mm / 60, mm % 60)
}

extension Color {
  init(hex: String) {
    var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if h.hasPrefix("#") { h.removeFirst() }
    var v: UInt64 = 0
    Scanner(string: h).scanHexInt64(&v)
    self.init(
      red: Double((v >> 16) & 0xFF) / 255,
      green: Double((v >> 8) & 0xFF) / 255,
      blue: Double(v & 0xFF) / 255)
  }
}

// MARK: - タイムライン

struct TodayEntry: TimelineEntry {
  let date: Date
  let data: DayData?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    TodayEntry(date: Date(), data: sampleData)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(TodayEntry(date: Date(), data: load() ?? sampleData))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let data = load()
    let now = Date()
    let entry = TodayEntry(date: now, data: data)
    // 次の予定の開始/終了時刻に自動で表示を更新する
    var refresh = now.addingTimeInterval(30 * 60)
    if let data = data, !data.events.isEmpty {
      let cal = Calendar.current
      let comp = cal.dateComponents([.hour, .minute], from: now)
      let nowMin = (comp.hour ?? 0) * 60 + (comp.minute ?? 0)
      var best = Int.max
      for e in data.events {
        for b in [e.minutesUntilStart(from: nowMin), e.minutesUntilEnd(from: nowMin)] where b > 0 && b < best {
          best = b
        }
      }
      if best < Int.max {
        refresh = now.addingTimeInterval(Double(best * 60 + 10))
      }
    }
    completion(Timeline(entries: [entry], policy: .after(refresh)))
  }

  private func load() -> DayData? {
    guard let ud = UserDefaults(suiteName: appGroup),
          let s = ud.string(forKey: "today"),
          let d = s.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(DayData.self, from: d)
  }
}

let sampleData = DayData(
  date: nil, pct: 40, done: 2, total: 5,
  events: [
    Ev(title: "仕事", icon: "💻", hex: "#4a8df8", start: 600, end: 720, done: 0),
    Ev(title: "ランチ", icon: "🍙", hex: "#d97706", start: 720, end: 780, done: 0),
    Ev(title: "筋トレ", icon: "💪", hex: "#f4526a", start: 1020, end: 1110, done: 0),
  ])

// MARK: - 表示

private let bg = Color(hex: "#0d1017")
private let ink = Color(hex: "#e8ecf4")
private let ink2 = Color(hex: "#9aa5b5")
private let brand = Color(hex: "#7bc5ba")

struct TodayView: View {
  @Environment(\.widgetFamily) var family
  let entry: TodayEntry

  var nowMin: Int {
    let c = Calendar.current.dateComponents([.hour, .minute], from: entry.date)
    return (c.hour ?? 0) * 60 + (c.minute ?? 0)
  }

  var current: Ev? { entry.data?.events.first { $0.contains(nowMin) } }

  var upcoming: [Ev] {
    guard let evs = entry.data?.events else { return [] }
    return evs.filter { !$0.contains(nowMin) && $0.done != 1 }
      .sorted { $0.minutesUntilStart(from: nowMin) < $1.minutesUntilStart(from: nowMin) }
  }

  var body: some View {
    Group {
      if entry.data == nil {
        VStack(spacing: 6) {
          Text("ADHDo").font(.system(.headline, design: .rounded)).bold().foregroundStyle(brand)
          Text("アプリを一度開くと\n今日の予定が表示されます")
            .font(.caption2).foregroundStyle(ink2).multilineTextAlignment(.center)
        }
      } else if family == .systemMedium {
        medium
      } else {
        small
      }
    }
  }

  // 進捗つきのNOWブロック(小・中共通の左側)
  @ViewBuilder
  func nowBlock(compact: Bool) -> some View {
    if let e = current {
      VStack(alignment: .leading, spacing: compact ? 4 : 6) {
        HStack(spacing: 6) {
          Text("NOW")
            .font(.system(size: 10, weight: .heavy, design: .rounded)).tracking(1)
            .foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 2.5)
            .background(Capsule().fill(e.color))
          Spacer(minLength: 0)
          Text("\(fmt(e.start))–\(fmt(e.end))")
            .font(.system(size: 11, weight: .semibold, design: .rounded).monospacedDigit())
            .foregroundStyle(ink2)
        }
        Text("\(e.icon ?? "") \(e.title)")
          .font(.system(size: compact ? 17 : 20, weight: .heavy, design: .rounded))
          .foregroundStyle(ink).lineLimit(2).minimumScaleFactor(0.7)
        let total = max(e.duration, 1)
        let left = e.minutesUntilEnd(from: nowMin)
        ProgressView(value: Double(total - left), total: Double(total))
          .tint(e.color).scaleEffect(y: 1.4)
        Text("あと\(left >= 60 ? "\(left / 60)時間" : "")\(left % 60 > 0 || left < 60 ? "\(left % 60)分" : "")")
          .font(.system(size: 10, weight: .semibold, design: .rounded))
          .foregroundStyle(e.color)
      }
    } else if let n = upcoming.first {
      VStack(alignment: .leading, spacing: compact ? 4 : 6) {
        Text("つぎの予定")
          .font(.system(size: 10, weight: .heavy, design: .rounded)).tracking(1)
          .foregroundStyle(ink2)
        Text("\(n.icon ?? "") \(n.title)")
          .font(.system(size: compact ? 17 : 20, weight: .heavy, design: .rounded))
          .foregroundStyle(ink).lineLimit(2).minimumScaleFactor(0.7)
        Text("\(fmt(n.start)) から")
          .font(.system(size: 12, weight: .semibold, design: .rounded).monospacedDigit())
          .foregroundStyle(n.color)
      }
    } else {
      VStack(spacing: 6) {
        Text("🎉").font(.system(size: 30))
        Text("今日のタスクは完了!")
          .font(.system(size: 13, weight: .bold, design: .rounded)).foregroundStyle(ink)
      }
    }
  }

  var small: some View {
    VStack(alignment: .leading, spacing: 0) {
      nowBlock(compact: true)
      Spacer(minLength: 0)
      if let pct = entry.data?.pct {
        Text("今日 \(pct)%")
          .font(.system(size: 10, weight: .bold, design: .rounded).monospacedDigit())
          .foregroundStyle(brand)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  var medium: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 0) {
        nowBlock(compact: false)
        Spacer(minLength: 0)
        if let d = entry.data, let pct = d.pct {
          Text("今日の達成率 \(pct)%(\(d.done ?? 0)/\(d.total ?? 0))")
            .font(.system(size: 10, weight: .bold, design: .rounded).monospacedDigit())
            .foregroundStyle(brand)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      Rectangle().fill(Color.white.opacity(0.08)).frame(width: 1)

      VStack(alignment: .leading, spacing: 7) {
        Text("このあと")
          .font(.system(size: 9, weight: .heavy, design: .rounded)).tracking(1)
          .foregroundStyle(ink2)
        // currentが無いときはnowBlockに出した先頭を除いた続きを見せる
        let list = Array(upcoming.dropFirst(current == nil ? 1 : 0).prefix(3))
        if list.isEmpty {
          Text("予定なし").font(.system(size: 11, design: .rounded)).foregroundStyle(ink2)
        }
        ForEach(Array(list.enumerated()), id: \.offset) { _, e in
          HStack(spacing: 6) {
            Circle().fill(e.color).frame(width: 6, height: 6)
            Text(fmt(e.start))
              .font(.system(size: 10, weight: .semibold, design: .rounded).monospacedDigit())
              .foregroundStyle(ink2)
            Text(e.title)
              .font(.system(size: 11, weight: .semibold, design: .rounded))
              .foregroundStyle(ink).lineLimit(1)
          }
        }
        Spacer(minLength: 0)
      }
      .frame(width: 118, alignment: .leading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

// MARK: - ウィジェット定義

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ADHDoToday", provider: Provider()) { entry in
      TodayView(entry: entry)
        .containerBackground(bg, for: .widget)
    }
    .configurationDisplayName("今なにする?")
    .description("NOWのタスクと次の予定をホーム画面で確認")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct ADHDoWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
  }
}
