"use client";

import { useEffect } from "react";
import { Button } from "@/components/Buttons";

// Хуудас ачаалагдмагц хэвлэх цонхыг нээнэ (зураг, QR ачаалагдахыг хүлээнэ). Дэлгэцэн дээр л харагдана.
const PrintToolbar = () => {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex justify-center gap-2 py-4 print:hidden">
      <Button variant="primary" onClick={() => window.print()}>
        Хэвлэх
      </Button>
      <Button onClick={() => window.close()}>Хаах</Button>
    </div>
  );
};

export default PrintToolbar;
