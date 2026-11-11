"use client";

import Link from "next/link";
import { usePathname } from "next/navigation"
import { useState } from "react";
import {
  LayoutDashboard, Building2, Users, Wrench, Contact,
  Settings, Menu, Laptop, ClipboardList, FileText, ShoppingCart, Receipt, Wallet, Truck, Boxes, ClipboardCheck
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/company-profile", label: "Company Profile", icon: Building2 },
  { href: "/users", label: "Users & Roles", icon: Users },
  { href: "/service-jobs", label: "Service Jobs", icon: Wrench },
  { href: "/item-master", label: "ItemMaster", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Contact },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/stock-summary", label: "Stock Summary", icon: ClipboardList },
  { href: "/eng-stock", label: "Eng Stock", icon: Boxes },
  { href: "/rmi", label: "RMI", icon: ClipboardCheck },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/delivery-challans", label: "Delivery Challans", icon: Truck },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/quotations", label: "Quotations", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export default function Sidebar({ user }) {
  const pathname = usePathname();
  const [expandedOnTouch, setExpandedOnTouch] = useState(false);

  return (
    <aside
      className={`sidebar ${expandedOnTouch ? "expanded" : ""}`}
      aria-label="Main navigation"
    >
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><Laptop size={20} /></div>
        <strong className="sidebar-label">Hardware CRM</strong>
      </div>

      {/* Touch users can toggle the sidebar; desktop users hover/focus it. */}
      <button
        type="button"
        className="sidebar-link menu-toggle"
        onClick={() => setExpandedOnTouch((value) => !value)}
        aria-label="Toggle navigation"
        aria-expanded={expandedOnTouch}
      >
        <Menu size={22} />
        <span className="sidebar-label">Toggle menu</span>
      </button>

      <nav className="sidebar-nav">
        {links.filter(({ href }) => user.role === "admin" || !["/company-profile", "/settings", "/users"].includes(href)).map(({ href, label, icon: Icon }) => {
          // Future modules show a friendly placeholder until implemented.
          const implemented = ["/dashboard", "/company-profile", "/users", "/item-master", "/stock-summary", "/purchases", "/sales", "/delivery-challans", "/expenses", "/customers", "/suppliers", "/quotations", "/settings", "/eng-stock", "/rmi", "/service-jobs"].includes(href);
          return (
            <Link
              key={href}
              href={implemented ? href : "#"}
              onClick={(event) => {
                if (!implemented) {
                  event.preventDefault();
                  // This navigation item is not available yet; avoid browser alert dialogs.
                }
              }}
              className={`sidebar-link ${pathname === href ? "active" : ""}`}
              aria-label={label}
              title={label}
            >
              <Icon size={22} />
              <span className="sidebar-label">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-bottom sidebar-nav">
        <div className="sidebar-link" title={`${user.fullName} (${user.role})`}>
          <Users size={22} />
          <span className="sidebar-label">{user.fullName} · {user.role}</span>
        </div>
      </div>
    </aside>
  );
}
