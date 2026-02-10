"use client";

import * as React from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

function initials(name?: string | null, email?: string | null) {
  const base = (name || email || "U").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  const two = (parts[0]?.[0] || "U") + (parts[1]?.[0] || "");
  return two.toUpperCase();
}

export function UserMenu() {
  const { data } = useSession();
  const user = data?.user;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src="/api/users/avatar" alt="Avatar" />
            <AvatarFallback className="text-xs">{initials(user?.name, user?.email)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm md:inline">{user?.name || user?.email || "Account"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Signed in</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={(e) => {
            e.preventDefault();
            signOut({ callbackUrl: "/" });
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
