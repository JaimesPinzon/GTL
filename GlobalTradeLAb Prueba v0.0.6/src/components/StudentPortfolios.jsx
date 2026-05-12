import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/market-data";
import { Users, Briefcase, DollarSign } from "lucide-react";

const StudentPortfolios = ({ students }) => {
  const { t } = useTranslation();

  if (!students || students.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5 text-primary" />
            {t("teacher.students.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{t("teacher.students.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Users className="mr-2 h-5 w-5 text-primary" />
          {t("teacher.students.title")} ({students.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] space-y-4 overflow-y-auto">
          {students.map((student) => (
            <div key={student.id} className="rounded-lg border border-border p-4">
              <h3 className="text-lg font-semibold text-foreground">{student.name}</h3>
              <p className="mb-2 text-sm text-muted-foreground">{student.email}</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center">
                  <DollarSign className="mr-2 h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-muted-foreground">{t("classes.common.balance")}:</p>
                    <p className="font-medium text-foreground">{formatCurrency(student.balance, "USD")}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Briefcase className="mr-2 h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-muted-foreground">{t("trading.positions.title")}:</p>
                    <p className="font-medium text-foreground">{student.positions?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentPortfolios;
