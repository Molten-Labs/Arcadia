export const Footer = () => (
    <footer className="mt-16 border-t border-border/40 bg-card/55 backdrop-blur-sm">
        <div className="container py-3 flex flex-col md:flex-row gap-1.5 justify-between text-[10px] text-muted-foreground font-mono">
            <span>© 2026 Molten Labs. Non-custodial. Use at your own risk.</span>
            <a
                href="https://explorer.solana.com/address/49StrXrpxCyC5VkmhossJLWx5nTCvyeoVMbPNMv9WcdN?cluster=devnet"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors truncate max-w-xs"
            >
                Program: 49StrXrpxCyC5VkmhossJLWx5nTCvyeoVMbPNMv9WcdN · devnet ↗
            </a>
        </div>
    </footer>
);
