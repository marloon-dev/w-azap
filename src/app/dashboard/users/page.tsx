"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Edit, User, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/components/i18n-provider";
import { translateValue } from "@/lib/i18n/translate";

interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    role: "SUPERADMIN" | "OWNER" | "STAFF";
    createdAt: string;
    _count?: {
        sessions: number;
    }
}

export default function UsersPage() {
    const { data: session } = useSession();
    const { t, locale } = useTranslation();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "OWNER"
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const responseData = await res.json();
                setUsers(responseData?.data || []);
            } else if (res.status === 403) {
                toast.error(t("users.unauthorized"));
            }
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
            const method = editingUser ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(editingUser ? t("users.updated") : t("users.created"));
                setShowForm(false);
                setEditingUser(null);
                setFormData({ name: "", email: "", password: "", role: "OWNER" });
                fetchUsers();
            } else {
                const error = await res.json();
                toast.error(error.error || t("users.opFailed"));
            }
        } catch (error) {
            toast.error(t("users.opFailed"));
        }
    };

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        try {
            const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("users.deleted"));
                fetchUsers();
            } else {
                const error = await res.json();
                toast.error(error.error || t("users.deleteFailed"));
            }
        } catch (error) {
            toast.error(t("users.deleteUserFailed"));
        } finally {
            setDeleteId(null);
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "SUPERADMIN": return <ShieldAlert className="h-4 w-4 text-destructive" />;
            case "OWNER": return <ShieldCheck className="h-4 w-4 text-info" />;
            default: return <User className="h-4 w-4 text-muted-foreground" />;
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground">{t("ui.loading")}</div>;

    // TODO: Improve RBAC check here if strictly needed, but API protects it.
    // If empty list and not loading, likely unauthorized or empty.

    return (
        <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
                        {t("users.title")}
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("users.subtitle")}</p>
                </div>
                <Button size="sm" onClick={() => {
                    setEditingUser(null);
                    setFormData({ name: "", email: "", password: "", role: "OWNER" });
                    setShowForm(true);
                }}>
                    <Plus className="h-4 w-4 mr-1 sm:mr-2" /> {t("users.add")}
                </Button>
            </div>

            {/* User Form Modal/Card */}
            {showForm && (
                <Card className="border-2 border-primary/20">
                    <CardHeader>
                        <CardTitle>{editingUser ? t("users.editTitle") : t("users.newTitle")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2">
                                    <Label>{t("users.name")}</Label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("auth.email")}</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2">
                                    <Label>{editingUser ? t("users.newPassword") : t("auth.password")}</Label>
                                    <Input
                                        type="password"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        required={!editingUser}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t("users.role")}</Label>
                                    <Select
                                        value={formData.role}
                                        onValueChange={(v: string) => setFormData({ ...formData, role: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SUPERADMIN">{t("roles.SUPERADMIN")}</SelectItem>
                                            <SelectItem value="OWNER">{t("roles.OWNER")}</SelectItem>
                                            <SelectItem value="STAFF">{t("roles.STAFF")}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{t("ui.cancel")}</Button>
                                <Button type="submit">{editingUser ? t("ui.update") : t("ui.create")}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Users Table */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {users.map(user => (
                    <Card key={user.id} className="overflow-hidden">
                        <CardContent className="p-0">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
                                            {user.name?.charAt(0) || user.email.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{user.name || t("common.user")}</h3>
                                            <p className="text-xs text-muted-foreground">{user.email}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="flex items-center gap-1">
                                        {getRoleIcon(user.role)}
                                        {translateValue(t, "roles", user.role)}
                                    </Badge>
                                </div>

                                <div className="flex justify-between items-center text-sm text-muted-foreground">
                                    <span>{t("users.sessionCount", { count: user._count?.sessions || 0 })}</span>
                                    <span>{t("users.joined", { date: new Date(user.createdAt).toLocaleDateString(locale) })}</span>
                                </div>
                            </div>
                            <div className="bg-muted/50 p-3 flex justify-end gap-2 border-t">
                                <Button size="sm" variant="ghost" onClick={() => {
                                    setEditingUser(user);
                                    setFormData({
                                        name: user.name || "",
                                        email: user.email,
                                        password: "",
                                        role: user.role
                                    });
                                    setShowForm(true);
                                }}>
                                    <Edit className="h-4 w-4 mr-1" /> {t("ui.edit")}
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(user.id)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> {t("ui.delete")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            {/* Confirmation Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("users.deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("users.deleteDesc")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("ui.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive">{t("users.continue")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function UsersIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
