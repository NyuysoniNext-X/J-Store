import logo from "@/assets/jstore-logo.jpeg";
import { Link } from "@tanstack/react-router";

export function Logo({
  className = "",
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <img src={logo} alt="J-STORE" className="h-9 w-9 rounded-lg object-cover shadow-elegant" />
      {showText && (
        <span className="font-display text-lg font-bold tracking-tight">
          J-STORE<span className="text-gold">.cm</span>
        </span>
      )}
    </Link>
  );
}
