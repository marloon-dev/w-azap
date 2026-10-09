"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "@/components/dashboard/session-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { User, Loader2, Camera, UserCircle, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/components/i18n-provider";

interface ProfileData {
    name?: string;
    pushname?: string;
    status?: string;
    pictureUrl?: string;
}

export default function ProfilePage() {
    const { sessionId } = useSession();
    const { t } = useTranslation();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(false);
    
    const [nameForm, setNameForm] = useState("");
    const [statusForm, setStatusForm] = useState("");
    
    const [updatingName, setUpdatingName] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingPic, setUpdatingPic] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (sessionId) {
            fetchProfile();
        }
    }, [sessionId]);

    const fetchProfile = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/profile/${sessionId}`);
            const data = await res.json();
            
            if (res.ok && data.data) {
                setProfile(data.data);
                setNameForm(data.data.name || data.data.pushname || "");
                setStatusForm(data.data.status || "");
            } else {
                toast.error(data.message || t("profile.loadFailed"));
            }
        } catch (error) {
            console.error("Fetch profile error:", error);
            toast.error(t("profile.fetchError"));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async () => {
        if (!sessionId) return;
        setUpdatingName(true);
        try {
            const res = await fetch(`/api/profile/${sessionId}/name`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: nameForm })
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(t("profile.nameUpdated"));
                setProfile(prev => prev ? { ...prev, name: nameForm } : null);
            } else {
                toast.error(data.message || t("profile.nameUpdateFailed"));
            }
        } catch (error) {
            console.error(error);
            toast.error(t("profile.nameUpdateError"));
        } finally {
            setUpdatingName(false);
        }
    };

    const handleUpdateStatus = async () => {
        if (!sessionId) return;
        setUpdatingStatus(true);
        try {
            const res = await fetch(`/api/profile/${sessionId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: statusForm })
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(t("profile.statusUpdated"));
                setProfile(prev => prev ? { ...prev, status: statusForm } : null);
            } else {
                toast.error(data.message || t("profile.statusUpdateFailed"));
            }
        } catch (error) {
            console.error(error);
            toast.error(t("profile.statusUpdateError"));
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !sessionId) return;

        setUpdatingPic(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch(`/api/profile/${sessionId}/picture`, {
                method: "PUT",
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(t("profile.picUpdated"));
                fetchProfile(); // Re-fetch to get the new picture URL
            } else {
                toast.error(data.message || t("profile.picUploadFailed"));
            }
        } catch (error) {
            console.error(error);
            toast.error(t("profile.picUploadError"));
        } finally {
            setUpdatingPic(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleRemovePicture = async () => {
        if (!sessionId) return;
        setUpdatingPic(true);
        try {
            const res = await fetch(`/api/profile/${sessionId}/picture`, {
                method: "DELETE"
            });
            const data = await res.json();
            
            if (res.ok) {
                toast.success(t("profile.picRemoved"));
                setProfile(prev => prev ? { ...prev, pictureUrl: "" } : null);
            } else {
                toast.error(data.message || t("profile.picRemoveFailed"));
            }
        } catch (error) {
            console.error(error);
            toast.error(t("profile.picRemoveError"));
        } finally {
            setUpdatingPic(false);
        }
    };

    if (!sessionId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
                <div className="h-16 w-16 bg-muted/50 rounded-full flex justify-center items-center">
                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">{t("profile.noSession")}</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        {t("profile.noSessionDesc")}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-5xl space-y-6">
            <div>
                <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">{t("profile.title")}</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("profile.subtitle")}</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Profile Picture Card */}
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle>{t("profile.picture")}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center space-y-6">
                            <div className="relative group">
                                <Avatar className="h-40 w-40 border-4 border-background shadow-md">
                                    <AvatarImage src={profile?.pictureUrl || ""} alt={t("profile.picture")} className="object-cover" />
                                    <AvatarFallback className="bg-muted text-muted-foreground">
                                        <User className="h-16 w-16" />
                                    </AvatarFallback>
                                </Avatar>
                                {updatingPic && (
                                    <div className="absolute inset-0 bg-background/50 rounded-full flex items-center justify-center backdrop-blur-sm z-10">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col w-full gap-2">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />
                                <Button 
                                    variant="outline" 
                                    className="w-full"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={updatingPic}
                                >
                                    <Camera className="w-4 h-4 mr-2" />
                                    {t("profile.changePhoto")}
                                </Button>
                                {(profile?.pictureUrl && profile.pictureUrl !== "") && (
                                    <Button 
                                        variant="ghost" 
                                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={handleRemovePicture}
                                        disabled={updatingPic}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t("profile.removePhoto")}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Profile Details Card */}
                    <div className="md:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t("profile.info")}</CardTitle>
                                <CardDescription>{t("profile.infoDesc")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <Label>{t("profile.name")}</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={nameForm} 
                                            onChange={(e) => setNameForm(e.target.value)} 
                                            placeholder={t("profile.namePlaceholder")} 
                                        />
                                        <Button onClick={handleUpdateName} disabled={updatingName || nameForm === profile?.name}>
                                            {updatingName ? <Loader2 className="w-4 h-4 animate-spin" /> : t("ui.save")}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{t("profile.nameHint")}</p>
                                </div>

                                <Card className="border-none shadow-none p-0 mt-4">
                                <div className="space-y-3 pt-4 border-t border-border">
                                    <Label>{t("profile.about")}</Label>
                                    <div className="space-y-3">
                                        <Textarea 
                                            value={statusForm} 
                                            onChange={(e) => setStatusForm(e.target.value)} 
                                            placeholder={t("profile.aboutPlaceholder")} 
                                            className="resize-none h-24"
                                            maxLength={139}
                                        />
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">{t("profile.characters", { count: statusForm.length })}</span>
                                            <Button onClick={handleUpdateStatus} disabled={updatingStatus || statusForm === profile?.status}>
                                                {updatingStatus ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                {t("profile.updateAbout")}
                                            </Button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">{t("profile.aboutHint")}</p>
                                </div>
                                </Card>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
