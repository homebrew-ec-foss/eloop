import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-gray-700 mb-6">:( This page could not be found.</p>
      <Link href="/" className="inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
        Return home
      </Link>
    </div>
  );
}
