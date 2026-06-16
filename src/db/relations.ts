import { relations } from "drizzle-orm/relations";
import { apiKey, rateLimit, people, events, sponsors, finance } from "./schema";

export const rateLimitRelations = relations(rateLimit, ({one}) => ({
	apiKey: one(apiKey, {
		fields: [rateLimit.keyId],
		references: [apiKey.id]
	}),
}));

export const apiKeyRelations = relations(apiKey, ({many}) => ({
	rateLimits: many(rateLimit),
}));

export const eventsRelations = relations(events, ({one, many}) => ({
	person: one(people, {
		fields: [events.eventLeadId],
		references: [people.id]
	}),
	finances: many(finance),
}));

export const peopleRelations = relations(people, ({many}) => ({
	events: many(events),
	sponsors: many(sponsors),
}));

export const sponsorsRelations = relations(sponsors, ({one}) => ({
	person: one(people, {
		fields: [sponsors.contactPersonId],
		references: [people.id]
	}),
}));

export const financeRelations = relations(finance, ({one}) => ({
	event: one(events, {
		fields: [finance.relatedEventId],
		references: [events.id]
	}),
}));