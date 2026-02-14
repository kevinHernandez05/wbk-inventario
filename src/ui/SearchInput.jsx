import { Search } from "lucide-react";

export default function SearchInput({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <div className="relative">
      <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        className="h-10 w-72 max-w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
