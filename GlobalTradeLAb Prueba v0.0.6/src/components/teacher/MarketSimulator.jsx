import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, ShieldAlert, CalendarDays, Activity, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SIMULATION_EFFECTS_DURATIONS = {
  crisis_2007: 300000,
  ww2: 600000,
  "9_11": 180000,
  elections: 120000,
};

const MarketSimulator = () => {
  const { t } = useTranslation();
  const { activeSimulation, setActiveSimulation } = useTradingWorkspace();
  const { toast } = useToast();

  const simulationEvents = [
    { id: "crisis_2007", name: t("marketSimulator.events.crisis_2007"), icon: <ShieldAlert className="mr-2 h-5 w-5 text-red-500" />, durationText: "5 min" },
    { id: "ww2", name: t("marketSimulator.events.ww2"), icon: <ShieldAlert className="mr-2 h-5 w-5 text-red-700" />, durationText: "10 min" },
    { id: "9_11", name: t("marketSimulator.events.nineEleven"), icon: <Zap className="mr-2 h-5 w-5 text-orange-500" />, durationText: "3 min" },
    { id: "elections", name: t("marketSimulator.events.elections"), icon: <CalendarDays className="mr-2 h-5 w-5 text-blue-500" />, durationText: "2 min" },
  ];

  const handleStartSimulation = (eventId) => {
    if (activeSimulation) {
      toast({
        title: t("marketSimulator.toasts.runningTitle"),
        description: t("marketSimulator.toasts.runningDescription"),
        variant: "destructive",
      });
      return;
    }

    const duration = SIMULATION_EFFECTS_DURATIONS[eventId];
    setActiveSimulation({ type: eventId, startTime: Date.now(), endTime: Date.now() + duration });
    const eventDetails = simulationEvents.find((event) => event.id === eventId);
    toast({
      title: t("marketSimulator.toasts.startedTitle"),
      description: t("marketSimulator.toasts.startedDescription", {
        name: eventDetails?.name,
        duration: eventDetails?.durationText,
      }),
    });
  };

  const handleStopSimulation = () => {
    setActiveSimulation(null);
    toast({
      title: t("marketSimulator.toasts.stoppedTitle"),
      description: t("marketSimulator.toasts.stoppedDescription"),
    });
  };

  React.useEffect(() => {
    let timer;

    const finishSimulation = () => {
      const activeEventName = simulationEvents.find((event) => event.id === activeSimulation?.type)?.name;
      toast({
        title: t("marketSimulator.toasts.finishedTitle"),
        description: t("marketSimulator.toasts.finishedDescription", { name: activeEventName }),
      });
      setActiveSimulation(null);
    };

    if (activeSimulation && Date.now() >= activeSimulation.endTime) {
      finishSimulation();
    } else if (activeSimulation) {
      timer = setTimeout(() => {
        if (Date.now() >= activeSimulation.endTime) {
          finishSimulation();
        }
      }, activeSimulation.endTime - Date.now());
    }

    return () => clearTimeout(timer);
  }, [activeSimulation, setActiveSimulation, simulationEvents, t, toast]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-6 w-6 text-primary" />
            {t("marketSimulator.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-6 text-muted-foreground">{t("marketSimulator.description")}</p>

          {activeSimulation && (
            <div className="mb-6 rounded-lg border border-yellow-500 bg-yellow-500/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-yellow-600">{t("marketSimulator.activeTitle")}</h3>
                  <p className="text-sm text-yellow-700">
                    {simulationEvents.find((event) => event.id === activeSimulation.type)?.name}
                  </p>
                  <p className="text-xs text-yellow-600">
                    {t("marketSimulator.remainingTime", {
                      minutes: Math.max(0, Math.round((activeSimulation.endTime - Date.now()) / 1000 / 60)),
                    })}
                  </p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleStopSimulation}>
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("marketSimulator.stop")}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {simulationEvents.map((event) => (
              <Button
                key={event.id}
                variant="outline"
                className="h-auto items-center justify-start px-4 py-3 text-left"
                onClick={() => handleStartSimulation(event.id)}
                disabled={Boolean(activeSimulation) && activeSimulation.type !== event.id}
              >
                {event.icon}
                <div>
                  <p className="font-medium">{event.name}</p>
                  <p className="text-xs text-muted-foreground">{t("marketSimulator.durationApprox", { value: event.durationText })}</p>
                </div>
              </Button>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted-foreground">{t("marketSimulator.note")}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default MarketSimulator;
