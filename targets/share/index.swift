import UIKit
import UniformTypeIdentifiers

// 共有シートから受け取った内容を App Group に書き込んで即閉じる(UIなし)
// 本体アプリが次回フォアグラウンドで "inboxQueue" を読み取り、Inboxに取り込む

class ShareViewController: UIViewController {
  let appGroup = "group.com.kozaburookuda.adhdo"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    handleShare()
  }

  func handleShare() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { finish(); return }
    let group = DispatchGroup()
    var entries: [[String: Any]] = []
    let lock = NSLock()
    let ts = Int(Date().timeIntervalSince1970 * 1000)
    var counter = 0

    func add(_ e: [String: Any]) {
      lock.lock(); entries.append(e); lock.unlock()
    }

    for item in items {
      for provider in item.attachments ?? [] {
        counter += 1
        let myTs = ts + counter
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.url.identifier) { data, _ in
            if let url = data as? URL {
              if url.isFileURL {
                if let d = try? Data(contentsOf: url), let img = UIImage(data: d),
                   let path = self.saveImage(img, ts: myTs) {
                  add(["ts": myTs, "imagePath": path])
                }
              } else {
                add(["ts": myTs, "url": url.absoluteString])
              }
            }
            group.leave()
          }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.image.identifier) { data, _ in
            var img: UIImage? = nil
            if let u = data as? URL, let d = try? Data(contentsOf: u) { img = UIImage(data: d) }
            else if let d = data as? Data { img = UIImage(data: d) }
            else if let im = data as? UIImage { img = im }
            if let im = img, let path = self.saveImage(im, ts: myTs) {
              add(["ts": myTs, "imagePath": path])
            }
            group.leave()
          }
        } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
          group.enter()
          provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) { data, _ in
            if let t = data as? String, !t.isEmpty { add(["ts": myTs, "text": t]) }
            group.leave()
          }
        }
      }
    }

    group.notify(queue: .main) {
      if !entries.isEmpty, let ud = UserDefaults(suiteName: self.appGroup) {
        let raw = ud.string(forKey: "inboxQueue") ?? "[]"
        var queue = (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [[String: Any]] ?? []
        queue.append(contentsOf: entries)
        if let d = try? JSONSerialization.data(withJSONObject: queue),
           let s = String(data: d, encoding: .utf8) {
          ud.set(s, forKey: "inboxQueue")
        }
      }
      self.finish()
    }
  }

  // 長辺1500px・JPEG圧縮で App Group コンテナに保存し、パスを返す
  func saveImage(_ image: UIImage, ts: Int) -> String? {
    var img = image
    let maxSide: CGFloat = 1500
    let m = max(image.size.width, image.size.height)
    if m > maxSide {
      let scale = maxSide / m
      let newSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
      UIGraphicsBeginImageContextWithOptions(newSize, true, 1)
      image.draw(in: CGRect(origin: .zero, size: newSize))
      img = UIGraphicsGetImageFromCurrentImageContext() ?? image
      UIGraphicsEndImageContext()
    }
    guard let data = img.jpegData(compressionQuality: 0.72),
          let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
    else { return nil }
    let folder = dir.appendingPathComponent("inbox", isDirectory: true)
    try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let file = folder.appendingPathComponent("img-\(ts).jpg")
    do { try data.write(to: file); return file.path } catch { return nil }
  }

  func finish() {
    extensionContext?.completeRequest(returningItems: nil)
  }
}
