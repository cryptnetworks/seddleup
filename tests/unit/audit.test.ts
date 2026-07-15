import { describe, expect, it } from "vitest";
import { auditActionLabel } from "@/lib/audit";

describe("auditActionLabel", () => {
  it("uses readable labels for trip activity events", () => {
    expect(auditActionLabel("expense.create")).toBe("Added an expense");
    expect(auditActionLabel("trip_payment.confirm")).toBe("Confirmed a payment received");
    expect(auditActionLabel("trip_payment.update")).toBe("Updated a payment confirmation");
    expect(auditActionLabel("trip_payment.delete")).toBe("Deleted a payment confirmation");
  });

  it("turns unknown event keys into a safe readable fallback", () => {
    expect(auditActionLabel("custom_event.completed-now")).toBe("Custom event completed now");
    expect(auditActionLabel("...")).toBe("Activity recorded");
  });
});
