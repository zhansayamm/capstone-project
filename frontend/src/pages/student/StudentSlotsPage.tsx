import { Button, Card, DatePicker, Divider, Flex, Input, message, Select, Space, Tag, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import type { Dayjs } from "dayjs";

import { createBooking } from "../../features/bookings/api/bookingApi";
import { listSlots } from "../../features/slots/api/slotApi";
import { useAsync } from "../../shared/hooks/useAsync";
import { disabledTimeForBusinessHours } from "../../shared/utils/businessHours";
import { dayjs } from "../../shared/utils/dayjs";
import { formatUserName } from "../../shared/utils/userDisplay";
import { Page } from "../../shared/ui/Page";
import type { Slot } from "../../shared/types/domain";

type SlotGroup = {
  key: string;
  title: string;
  description?: string | null;
  professor_id: number;
  professorLabel: string;
  dateKey: string; // YYYY-MM-DD
  slots: Slot[];
};

export function StudentSlotsPage() {
  const slotsQuery = useAsync(listSlots);
  const book = useAsync(createBooking);

  const [availableOnly, setAvailableOnly] = useState(true);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [professorId, setProfessorId] = useState<number | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [bookingNote, setBookingNote] = useState("");

  useEffect(() => {
    slotsQuery.run({ limit: 50, available: availableOnly });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableOnly]);

  const filtered = useMemo(() => {
    const items = slotsQuery.state.value ?? [];
    const byProfessor = professorId ? items.filter((s) => s.professor_id === professorId) : items;
    if (!range) return byProfessor;
    const [from, to] = range;
    const fromMs = from ? from.valueOf() : null;
    const toMs = to ? to.valueOf() : null;
    return byProfessor.filter((s) => {
      const st = dayjs(s.start_time).valueOf();
      if (fromMs !== null && st < fromMs) return false;
      if (toMs !== null && st > toMs) return false;
      return true;
    });
  }, [professorId, range, slotsQuery.state.value]);

  const professorOptions = useMemo(() => {
    const items = slotsQuery.state.value ?? [];
    const ids = Array.from(new Set(items.map((s) => s.professor_id))).sort((a, b) => a - b);
    return ids.map((id) => {
      const sample = items.find((s) => s.professor_id === id) ?? null;
      return { label: formatUserName(sample?.professor, { id }), value: id };
    });
  }, [slotsQuery.state.value]);

  const groupedSlots = useMemo<SlotGroup[]>(() => {
    const groups = new Map<string, SlotGroup>();
    for (const s of filtered) {
      const dateKey = dayjs(s.start_time).format("YYYY-MM-DD");
      const professorLabel = formatUserName(s.professor, { id: s.professor_id });
      const key = `${s.title}::${s.professor_id}::${dateKey}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          key,
          title: s.title,
          description: s.description ?? null,
          professor_id: s.professor_id,
          professorLabel,
          dateKey,
          slots: [s],
        });
      } else {
        existing.slots.push(s);
      }
    }

    const arr = Array.from(groups.values());
    for (const g of arr) {
      g.slots.sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
    }
    arr.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
      if (a.professorLabel !== b.professorLabel) return a.professorLabel.localeCompare(b.professorLabel);
      return a.title.localeCompare(b.title);
    });
    return arr;
  }, [filtered]);

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    const slot = selectedSlot;
    const isPast = dayjs(slot.end_time).isBefore(dayjs());
    if (isPast) return;
    setBookingSlotId(slot.id);
    try {
      const booking = await book.run({ slot_id: slot.id, description: bookingNote });
      if (booking.status === "approved" || booking.status === "booked") message.success("Booking approved");
      else if (booking.status === "rejected") message.error("Booking rejected");
      else message.info("Booking request submitted (pending approval)");
      await slotsQuery.run({ limit: 50, available: availableOnly });
    } finally {
      setBookingSlotId(null);
      setSelectedSlot(null);
      setBookingNote("");
    }
  };

  return (
    <Page>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 12 }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Available slots
        </Typography.Title>
      </Flex>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, flex: 1 }}>
          <Select
            allowClear
            placeholder="Professor"
            style={{ minWidth: 180, maxWidth: 260 }}
            options={professorOptions}
            value={professorId ?? undefined}
            onChange={(v) => setProfessorId(v ?? null)}
          />
          <DatePicker.RangePicker
            showTime
            allowEmpty={[true, true]}
            style={{ minWidth: 260, maxWidth: 420 }}
            value={range as [Dayjs | null, Dayjs | null] | null}
            onChange={(v) => setRange((v as [Dayjs | null, Dayjs | null] | null) ?? null)}
            disabledTime={disabledTimeForBusinessHours}
            disabledDate={(current) => {
              if (!current) return false;
              return current.endOf("day").isBefore(dayjs().startOf("day"));
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => setAvailableOnly((v) => !v)}>
            {availableOnly ? "Show all" : "Available only"}
          </Button>
          <Button type="primary" loading={slotsQuery.state.loading} onClick={() => slotsQuery.run({ limit: 50, available: availableOnly })}>
            Refresh
          </Button>
        </div>
      </div>

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {groupedSlots.length === 0 ? (
          <Card>
            <Typography.Text type="secondary">No slots found. Try changing filters or refresh.</Typography.Text>
          </Card>
        ) : (
          groupedSlots.map((g) => (
            <Card key={g.key} bodyStyle={{ padding: 16 }}>
              <Flex align="center" justify="space-between" wrap gap={12}>
                <div>
                  <Space align="baseline" wrap size={8}>
                    {g.description ? (
                      <Tooltip title={g.description}>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                          {g.title}
                        </Typography.Title>
                      </Tooltip>
                    ) : (
                      <Typography.Title level={4} style={{ margin: 0 }}>
                        {g.title}
                      </Typography.Title>
                    )}
                    <Tag color="blue">{g.professorLabel}</Tag>
                    <Tag>{dayjs(g.dateKey).format("ddd, MMM D")}</Tag>
                  </Space>
                  {g.description ? (
                    <Typography.Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 0 }}>
                      {g.description}
                    </Typography.Paragraph>
                  ) : null}
                </div>
              </Flex>

              <Divider style={{ margin: "12px 0" }} />

              <Flex wrap gap={8}>
                {g.slots.map((s) => {
                  const isPast = dayjs(s.end_time).isBefore(dayjs());
                  const disabled = isPast || s.is_booked || book.state.loading;
                  const isSelected = selectedSlot?.id === s.id;
                  const timeLabel = dayjs(s.start_time).format("HH:mm");
                  return (
                    <Button
                      key={s.id}
                      size="small"
                      type={isSelected ? "primary" : disabled ? "default" : "primary"}
                      ghost={!disabled && !isSelected}
                      disabled={disabled}
                      loading={bookingSlotId === s.id}
                      onClick={() => setSelectedSlot(s)}
                      style={{ borderRadius: 999 }}
                    >
                      {timeLabel}
                    </Button>
                  );
                })}
              </Flex>

              {selectedSlot && g.slots.some((s) => s.id === selectedSlot.id) ? (
                <Card style={{ marginTop: 12, background: "#f6ffed", borderColor: "#b7eb8f" }} bodyStyle={{ padding: 12 }}>
                  <Flex align="center" justify="space-between" wrap gap={10}>
                    <div>
                      <Typography.Text strong>Selected time:</Typography.Text>{" "}
                      <Typography.Text>
                        {dayjs(selectedSlot.start_time).format("HH:mm")} – {dayjs(selectedSlot.end_time).format("HH:mm")}
                      </Typography.Text>
                      <div style={{ marginTop: 10 }}>
                        <Input.TextArea
                          value={bookingNote}
                          onChange={(e) => setBookingNote(e.target.value)}
                          maxLength={200}
                          rows={3}
                          placeholder="Add note (optional): e.g. topic, project, question…"
                        />
                      </div>
                    </div>
                    <Space>
                      <Button onClick={() => setSelectedSlot(null)} disabled={book.state.loading}>
                        Cancel
                      </Button>
                      <Button
                        type="primary"
                        danger={false}
                        loading={bookingSlotId === selectedSlot.id}
                        onClick={handleConfirmBooking}
                      >
                        Confirm booking
                      </Button>
                    </Space>
                  </Flex>
                </Card>
              ) : null}

              <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
                Click a time to select it, then confirm booking.
              </Typography.Paragraph>
            </Card>
          ))
        )}
      </Space>
    </Page>
  );
}

