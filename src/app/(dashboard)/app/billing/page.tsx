"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Gift,
  History,
  Loader2,
  Check,
  Coins,
  Plus,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  amount_cents: number;
  currency: string;
  credits_purchased: number;
  status: string;
  created_at: string;
}

const CREDIT_PRICE_AUD = 2;

export default function BillingPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [promoCode, setPromoCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [creditsToBuy, setCreditsToBuy] = useState<number>(10);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    fetchCredits();
    fetchHistory();
    fetchPayments();
    
    // Check for payment success
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const creditsAdded = params.get("credits");
      toast.success(`Payment successful! ${creditsAdded} credits added.`);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      // Clean URL
      window.history.replaceState({}, "", "/app/billing");
      // Refresh credits
      setTimeout(fetchCredits, 1000);
    }
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

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/stripe/payments");
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments || []);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
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
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
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

  const handlePurchase = async () => {
    if (creditsToBuy < 1) {
      toast.error("Please enter at least 1 credit");
      return;
    }

    setIsPurchasing(true);
    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: creditsToBuy }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create checkout");
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
      setIsPurchasing(false);
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

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "promo_code":
        return <Gift className="w-4 h-4" />;
      case "render":
        return <CreditCard className="w-4 h-4" />;
      case "purchase":
        return <Plus className="w-4 h-4" />;
      default:
        return <Coins className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-700">Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      case "refunded":
        return <Badge className="bg-gray-100 text-gray-700">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Billing & Credits</h1>
          <p className="text-muted-foreground">
            Manage your credits, purchase more, and view payment history
          </p>
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

        {/* Buy Credits */}
        <Card className="border-cyan-200 bg-gradient-to-r from-cyan-50/50 to-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-700">
              <CreditCard className="w-5 h-5" />
              Buy Credits
            </CardTitle>
            <CardDescription>
              Purchase credits with your credit card. ${CREDIT_PRICE_AUD} AUD per credit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium">Number of credits</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={creditsToBuy}
                    onChange={(e) => setCreditsToBuy(parseInt(e.target.value) || 0)}
                    className="w-32"
                  />
                  <div className="flex gap-1">
                    {[5, 10, 25, 50].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() => setCreditsToBuy(amount)}
                        className={cn(
                          "min-w-[3rem]",
                          creditsToBuy === amount && "bg-cyan-100 border-cyan-300"
                        )}
                      >
                        {amount}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-cyan-700">
                    ${(creditsToBuy * CREDIT_PRICE_AUD).toFixed(2)} AUD
                  </p>
                </div>
                <Button
                  onClick={handlePurchase}
                  disabled={isPurchasing || creditsToBuy < 1}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {isPurchasing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Buy Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
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

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment History
            </CardTitle>
            <CardDescription>
              Your past credit purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No payments yet
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {payment.credits_purchased} credit{payment.credits_purchased > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {formatCurrency(payment.amount_cents, payment.currency)}
                      </span>
                      {getStatusBadge(payment.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Credit Usage History
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
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
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
