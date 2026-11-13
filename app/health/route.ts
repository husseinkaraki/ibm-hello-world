import nextPackage from 'next/package.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET() {
  return Response.json({
    status: 'ok',
    app: 'ibm-hello-world',
    version: '1.0.0',
    framework: 'Next.js',
    nextVersion: nextPackage.version,
    language: 'TypeScript',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
