"use client";

import type { ComponentType } from "react";
import HTMLFlipBookImport from "react-pageflip";
import CoverPage from "./CoverPage";
import BackCover from "./BackCover";

// react-pageflip's own type definitions mark ~12 props (style, startPage,
// flippingTime, usePortrait, etc.) as required, even though the library's
// actual implementation supplies working defaults for every one of them —
// this is a known upstream typings bug, not a real missing-prop error.
// Passing only the props we actually want to override (as the library's
// own docs/examples do) is correct at runtime; TypeScript just can't see
// that. Cast past the broken types rather than inventing values for a
// dozen props we don't want to override.
const HTMLFlipBook = HTMLFlipBookImport as unknown as ComponentType<any>;

const pages = [
  "/constitution/pages/page-1.webp",
  "/constitution/pages/page-2.webp",
  "/constitution/pages/page-3.webp",
  "/constitution/pages/page-4.webp",
];

export default function FlipBook() {
  return (
    <div className="flipbook-container">

      <HTMLFlipBook
        width={550}
        height={780}
        size="stretch"
        minWidth={300}
        maxWidth={1000}
        minHeight={420}
        maxHeight={1500}
        mobileScrollSupport={true}
        showCover={true}
        drawShadow={true}
        className="flipbook"
      >

        <div>
          <CoverPage />
        </div>

        {pages.map((src, index) => (
          <div
            key={index}
            className="book-page"
          >
            <img
              src={src}
              alt={`Page ${index + 1}`}
            />
          </div>
        ))}

        <div>
          <BackCover />
        </div>

      </HTMLFlipBook>

    </div>
  );
}