import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  checkDocumentation,
  githubSlug,
  markdownAnchors,
  markdownDestinations
} from "../../scripts/check-doc-links.mjs";

describe("documentation link validation", () => {
  it("matches GitHub-style heading slugs and duplicate suffixes", () => {
    expect(githubSlug("Release & rollback readiness")).toBe("release-rollback-readiness");
    expect(markdownAnchors("# Deploy\n\n## Verify\n\n## Verify")).toEqual(
      new Set(["deploy", "verify", "verify-1"])
    );
  });

  it("ignores fenced examples and reports duplicate reference definitions", () => {
    const destinations = markdownDestinations(
      [
        "[Guide](docs/guide.md#start)",
        "[guide]: docs/guide.md",
        "[GUIDE]: docs/other.md",
        "```md",
        "[Ignored](missing.md)",
        "```"
      ].join("\n")
    );

    expect(destinations).toEqual([
      { destination: "docs/guide.md#start", line: 1, error: null },
      { destination: "docs/guide.md", line: 2 },
      { destination: null, line: 3, error: "duplicate reference definition [GUIDE]" }
    ]);
  });

  it("reports missing files and GitHub-style heading anchors", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "seddleup-doc-links-"));
    try {
      await mkdir(path.join(root, "docs"));
      await writeFile(
        path.join(root, "README.md"),
        "# Home\n\n[Missing file](docs/missing.md)\n\n[Missing heading](docs/guide.md#absent)\n"
      );
      await writeFile(path.join(root, "docs/guide.md"), "# Present\n");

      const result = await checkDocumentation(root);

      expect(result.errors).toEqual([
        expect.stringContaining("missing internal target docs/missing.md"),
        expect.stringContaining("missing heading #absent in docs/guide.md")
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
