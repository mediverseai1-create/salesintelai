"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/utils";

const INK = "#1e1611";
const ACCENT = "#c93f0c";
const MUTED = "#6f6256";

const tip = { contentStyle: { background: "#fbf8f1", border: "1px solid #1e1611", borderRadius: 2, fontSize: 12 }, cursor: { fill: "rgba(30,22,17,0.06)" } };

export function RevenueByMonth({ data }: { data: { month: string; revenue: number }[] }) {
  const last = data.length - 1;
  return (
    <div role="img" aria-label="Closed-won revenue by month" className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ddd3c2" />
          <XAxis dataKey="month" tickFormatter={(m: string) => m.slice(5)} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => money(v, true)} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
          <Tooltip {...tip} formatter={(v) => [money(Number(v)), "Revenue"]} />
          <Bar dataKey="revenue" radius={0}>
            {data.map((_, i) => <Cell key={i} fill={i === last ? ACCENT : INK} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StageBars({ data }: { data: { stage: string; value: number; count: number }[] }) {
  return (
    <div role="img" aria-label="Open pipeline value by stage" className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#ddd3c2" />
          <XAxis type="number" tickFormatter={(v: number) => money(v, true)} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="stage" tick={{ fill: INK, fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
          <Tooltip {...tip} formatter={(v, _n, p) => [`${money(Number(v))} · ${(p?.payload as { count: number }).count} deals`, "Open"]} />
          <Bar dataKey="value" fill={INK} radius={0} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelBars({ data }: { data: { stage: string; reached: number }[] }) {
  return (
    <div role="img" aria-label="Deals that reached each stage" className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ddd3c2" />
          <XAxis dataKey="stage" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip {...tip} formatter={(v) => [String(v), "Deals"]} />
          <Bar dataKey="reached" fill={ACCENT} radius={0} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
