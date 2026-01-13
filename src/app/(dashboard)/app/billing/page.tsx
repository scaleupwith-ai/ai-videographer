"use client";

import { useState, useEffect } from "react";
import { CreditCard, Gift, History, Loader2, Check, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function BillingPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    fetchCredits();
    fetchHistory();
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await fetch("/api/credits");
      if (response.ok) {
        const data = await response.json();
        setCredits(data.credits);
      }
    } catch (error) {
      console.error("Failed to fetch credits:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch("/api/credits/history");
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    setIsRedeeming(true);
    try {
      const response = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`+${data.creditsAdded} credits added!`);
        setCredits(data.newBalance);
        setPromoCode("");
        fetchHistory();
      } else {
        toast.error(data.error || "Failed to redeem code");
      }
    } catch {
      toast.error("Failed to redeem code");
    } finally {
      setIsRedeeming(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "promo_code":
        return <Gift className="w-4 h-4" />;
      case "render":
        return <CreditCard className="w-4 h-4" />;
      default:
        return <Coins className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Billing & Credits</h1>
          <p className="text-muted-foreground">Manage your credits and redeem promo codes</p>
        </div>

        {/* Credits Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Coins className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Credits</p>
                  <p className="text-4xl font-bold">
                    {isLoading ? (
                      <Loader2 className="w-8 h-8 animate-spin" />
                    ) : (
                      credits ?? 0
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">1 credit = 1 video render</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Redeem Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Redeem Promo Code
            </CardTitle>
            <CardDescription>
              Enter a promo code to add free credits to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRedeem} className="flex gap-3">
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g., WELCOME10)"
                className="flex-1 uppercase"
                disabled={isRedeeming}
              />
              <Button type="submit" disabled={!promoCode.trim() || isRedeeming}>
                {isRedeeming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Redeem
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Transaction History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No transactions yet
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        tx.amount > 0
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

