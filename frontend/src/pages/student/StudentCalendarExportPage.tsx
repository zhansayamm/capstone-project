/** TODO: possibly unused file — not imported by `appRouter.tsx`; verify before deletion or wire to navigation. */

import { Button, Card, Typography } from "antd";

import { calendarApi } from "../../shared/api";
import { downloadBlob } from "../../shared/utils/download";
import { Page } from "../../shared/ui/Page";

export function StudentCalendarExportPage() {
  return (
    <Page>
      <Typography.Title level={2} style={{ marginTop: 8 }}>
        Calendar export
      </Typography.Title>
      <Card>
        <Typography.Paragraph>
          Download an <Typography.Text code>.ics</Typography.Text> file containing your booked office hours and classroom reservations.
        </Typography.Paragraph>
        <Button
          type="primary"
          onClick={async () => {
            const blob = await calendarApi.downloadMyCalendarIcs();
            downloadBlob(blob, "booking-time.ics");
          }}
        >
          Download .ics
        </Button>
      </Card>
    </Page>
  );
}

