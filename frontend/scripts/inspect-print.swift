// Optional macOS PDF verification using system frameworks, not an app dependency.
import AppKit
import Foundation
import PDFKit

let folder = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let files = ["card", "booklet", "nextwalk"]
var report: [[String: Any]] = []
for name in files {
    guard let document = PDFDocument(url: folder.appendingPathComponent("\(name).pdf")) else {
        fatalError("Missing PDF: \(name)")
    }
    var text = ""
    var sizes: [[Double]] = []
    for index in 0..<document.pageCount {
        let page = document.page(at: index)!
        let bounds = page.bounds(for: .mediaBox)
        precondition(abs(bounds.width - 419.53) < 2 && abs(bounds.height - 595.28) < 2, "Expected A5")
        let pageText = page.string ?? ""
        precondition(!pageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "Blank page")
        text += pageText + "\n"
        sizes.append([Double(bounds.width), Double(bounds.height)])
        let image = page.thumbnail(of: NSSize(width: 840, height: 1190), for: .mediaBox)
        let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
        try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent("\(name)-page-\(index + 1).png"))
    }
    precondition(!text.contains("SECRET"), "Private data in PDF")
    precondition(text.contains("Not medical advice."), "Missing notice")
    precondition(!text.contains("Print / Save as PDF"), "Screen toolbar printed")
    if name == "card" { precondition(document.pageCount == 1, "Compact card should fit on one A5 page") }
    if name == "booklet" {
        precondition(document.pageCount >= 4, "Long card must continue across pages")
        precondition(text.contains("END OF LONG MEMORY"), "Long content clipped")
        precondition(text.contains("1 private plant was left out."), "Missing skipped count")
    }
    if name == "nextwalk" {
        precondition(text.contains("Folio #"), "Missing anonymous private folio")
        precondition(text.contains("What memory would you like to share?"), "Missing saved private question")
        precondition(text.contains("Is there a family story?"), "Missing saved shareable question")
    }
    report.append(["file": name + ".pdf", "pages": document.pageCount, "sizesPt": sizes, "text": text])
}
let json = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
try json.write(to: folder.appendingPathComponent("pdf-report.json"))
print(String(data: json, encoding: .utf8)!)
