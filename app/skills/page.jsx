'use client';

import React, { Suspense } from 'react';
import PageContent from './PageContent';

export default function Wrapper() {
  return (
    <Suspense fallback={<div className="text-white text-center p-6">Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
