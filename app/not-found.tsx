import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-center">
            <div className="bg-secondary p-4 rounded-full mb-4">
                <span className="text-4xl">🔍</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground mb-6">Could not find requested resource</p>
            <Link
                href="/"
                className="rounded-lg bg-primary px-6 py-3 font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
                Return Home
            </Link>
        </div>
    );
}
