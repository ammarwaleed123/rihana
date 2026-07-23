import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnnouncementBody } from "@/components/announcement-body";

/**
 * The announcement renderer is the one place staff text becomes markup shown to
 * every family, so its whole job is to be un-injectable. These render it to a
 * static HTML string and assert both that the safe subset works AND that nothing
 * dangerous survives — no raw tags, no non-http links.
 *
 * The component is pure (no hooks), so it can be called as a function and handed
 * straight to `renderToStaticMarkup`, no DOM required.
 */
function render(markdown: string): string {
  return renderToStaticMarkup(AnnouncementBody({ markdown }));
}

describe("AnnouncementBody", () => {
  it("renders paragraphs and the safe inline subset", () => {
    const html = render("Hello **there** and *welcome*.");
    expect(html).toContain("<p");
    expect(html).toContain("<strong>there</strong>");
    expect(html).toContain("<em>welcome</em>");
  });

  it("renders a bullet list", () => {
    const html = render("- one\n- two");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("links only http(s) URLs, with rel/noopener", () => {
    const html = render("See [the site](https://rihana.example).");
    expect(html).toContain('href="https://rihana.example"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("never renders a javascript: link — it degrades to plain text", () => {
    const html = render("[click me](javascript:alert(1))");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click me");
  });

  it("never renders other non-http schemes as links", () => {
    for (const url of ["data:text/html,x", "file:///etc/passwd", "vbscript:x"]) {
      const html = render(`[x](${url})`);
      expect(html).not.toContain("<a");
    }
  });

  it("escapes raw HTML in the source rather than emitting it", () => {
    const html = render("<script>alert(1)</script> and <img src=x onerror=y>");
    // React escapes text, so the tags come out inert.
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an HTML payload smuggled inside a link label", () => {
    const html = render("[<b>x</b>](https://ok.example)");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});
