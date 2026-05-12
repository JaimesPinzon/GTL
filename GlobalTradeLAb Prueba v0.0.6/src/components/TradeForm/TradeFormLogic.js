import { useState } from "react";
import { useTranslation } from "react-i18next";

const TradeFormLogic = ({
  selectedSymbol,
  openPosition,
  getCurrentPrice,
  toast,
  userCurrency,
}) => {
  const { t } = useTranslation();
  const [tradeMode, setTradeMode] = useState("amount");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("");
  const [tradeType, setTradeType] = useState("BUY");
  const [justification, setJustification] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [attachmentName, setAttachmentName] = useState("");

  const currentPrice = getCurrentPrice(selectedSymbol);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: t("trading.form.fileTooLargeTitle"),
          description: t("trading.form.fileTooLargeDescription"),
          variant: "destructive",
        });
        setAttachment(null);
        setAttachmentName("");
        if (event.target) {
          event.target.value = null;
        }
        return;
      }

      if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
        toast({
          title: t("trading.form.invalidFileTypeTitle"),
          description: t("trading.form.invalidFileTypeDescription"),
          variant: "destructive",
        });
        setAttachment(null);
        setAttachmentName("");
        if (event.target) {
          event.target.value = null;
        }
        return;
      }

      setAttachment(file);
      setAttachmentName(file.name);
      return;
    }

    setAttachment(null);
    setAttachmentName("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    let investmentAmountUSD = 0;

    if (tradeMode === "amount") {
      investmentAmountUSD = Number.parseFloat(amount);
      if (!Number.isFinite(investmentAmountUSD) || investmentAmountUSD <= 0) {
        toast({
          title: t("trading.form.invalidAmountTitle"),
          description: t("trading.form.invalidAmountDescription", { currency: userCurrency }),
          variant: "destructive",
        });
        return;
      }
    } else {
      const parsedQuantity = Number.parseFloat(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        toast({
          title: t("trading.form.invalidQuantityTitle"),
          description: t("trading.form.invalidQuantityDescription"),
          variant: "destructive",
        });
        return;
      }
      investmentAmountUSD = parsedQuantity * currentPrice;
    }

    if (!justification.trim()) {
      toast({
        title: t("trading.form.missingJustificationTitle"),
        description: t("trading.form.missingJustificationDescription"),
        variant: "destructive",
      });
      return;
    }

    const success = await openPosition(
      selectedSymbol,
      tradeType,
      investmentAmountUSD,
      currentPrice,
      justification,
      attachmentName
    );

    if (success) {
      setAmount("");
      setQuantity("");
      setJustification("");
      handleFileChange({ target: { files: [] } });
    }
  };

  let totalCostUSD = 0;
  if (tradeMode === "quantity" && Number.parseFloat(quantity) > 0 && currentPrice > 0) {
    totalCostUSD = Number.parseFloat(quantity) * currentPrice;
  } else if (tradeMode === "amount" && Number.parseFloat(amount) > 0) {
    totalCostUSD = Number.parseFloat(amount);
  }

  return {
    tradeMode,
    setTradeMode,
    amount,
    setAmount,
    quantity,
    setQuantity,
    tradeType,
    setTradeType,
    justification,
    setJustification,
    attachment,
    setAttachment,
    attachmentName,
    setAttachmentName,
    handleFileChange,
    handleSubmit,
    totalCostUSD,
  };
};

export default TradeFormLogic;
