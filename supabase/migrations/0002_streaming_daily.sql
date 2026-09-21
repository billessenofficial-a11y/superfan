CREATE TABLE "streaming_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"provider" "integration_provider" DEFAULT 'spotify' NOT NULL,
	"day" date NOT NULL,
	"streams" integer DEFAULT 0 NOT NULL,
	"monthly_listeners" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"saves" integer DEFAULT 0 NOT NULL,
	"playlist_adds" integer DEFAULT 0 NOT NULL,
	"top_tracks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "streaming_daily" ADD CONSTRAINT "streaming_daily_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "streaming_daily_artist_provider_day_idx" ON "streaming_daily" USING btree ("artist_id","provider","day");--> statement-breakpoint
CREATE INDEX "streaming_daily_artist_day_idx" ON "streaming_daily" USING btree ("artist_id","day");--> statement-breakpoint
DROP TRIGGER IF EXISTS streaming_daily_set_updated_at ON public.streaming_daily;--> statement-breakpoint
CREATE TRIGGER streaming_daily_set_updated_at BEFORE UPDATE ON public.streaming_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
ALTER TABLE public.streaming_daily ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS streaming_daily_member_select ON public.streaming_daily;--> statement-breakpoint
CREATE POLICY streaming_daily_member_select ON public.streaming_daily FOR SELECT USING (public.is_artist_member(artist_id));
