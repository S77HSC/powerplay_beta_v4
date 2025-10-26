// suspense-fix-all.js
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, 'app');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, fileList);
    } else if (file === 'page.jsx') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function needsSuspenseFix(fileContent) {
  return (
    fileContent.includes('useSearchParams') ||
    fileContent.includes('useRouter') ||
    fileContent.includes('usePathname')
  );
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(s => s[0].toUpperCase() + s.slice(1))
    .join('');
}

function run() {
  const pageFiles = walk(ROOT_DIR);
  let fixedCount = 0;

  for (const pagePath of pageFiles) {
    const content = fs.readFileSync(pagePath, 'utf-8');
    if (!needsSuspenseFix(content)) continue;

    const dir = path.dirname(pagePath);
    const contentFilename = path.join(dir, 'PageContent.jsx');

    const hasUseClient = content.trim().startsWith("'use client';") || content.trim().startsWith('"use client";');
    const hasDynamic = content.includes("export const dynamic = 'force-dynamic';");

    // Backup the original page
    fs.copyFileSync(pagePath, `${pagePath}.backup`);

    // Write original logic into PageContent.jsx
    const contentWithClient = hasUseClient ? content : `'use client';\n\n${content}`;
    fs.writeFileSync(contentFilename, contentWithClient);

    // Create a wrapper page.jsx with Suspense
    const wrapper = `'use client';

${hasDynamic ? "export const dynamic = 'force-dynamic';\n" : ''}
import React, { Suspense } from 'react';
import PageContent from './PageContent';

export default function Wrapper() {
  return (
    <Suspense fallback={<div className="text-white text-center p-6">Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
`;
    fs.writeFileSync(pagePath, wrapper);
    fixedCount++;
    console.log(`✅ Fixed: ${pagePath}`);
  }

  if (fixedCount === 0) {
    console.log('✅ No fixes needed. All good.');
  } else {
    console.log(`\n🎉 Done. ${fixedCount} file(s) updated and backed up.`);
  }
}

run();
