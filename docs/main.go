package main

import (
	"log/slog"
	"math/rand"
	"strconv"

	"github.com/picosh/pdocs"
)

func main() {
	pager := pdocs.Pager("./posts")
	sitemap := &pdocs.Sitemap{
		Children: []*pdocs.Sitemap{
			{
				Text: "Home",
				Href: "/",
				Page: pager("home.md"),
			},
			{
				Text: "Sitemap",
				Href: "/sitemap",
				Page: pager("sitemap.md"),
			},
			{
				Text: "Getting started",
				Href: "/getting-started",
				Page: pager("getting-started.md"),
			},
			{
				Text: "Learn",
				Href: "/learn",
				Page: pager("learn.md"),
			},
			{
				Text: "Controllers",
				Href: "/controllers",
				Page: pager("controllers.md"),
				Children: []*pdocs.Sitemap{
					{
						Text: "Thunks",
						Href: "/thunks",
						Page: pager("thunks.md"),
					},
					{
						Text: "Endpoints",
						Href: "/endpoints",
						Page: pager("endpoints.md"),
					},
					{
						Text: "Dispatch",
						Href: "/dispatch",
						Page: pager("dispatch.md"),
					},
				},
			},
			{
				Text: "Models",
				Href: "/models",
				Page: pager("models.md"),
				Children: []*pdocs.Sitemap{
					{

						Text: "Store",
						Href: "/store",
						Page: pager("store.md"),
					},
					{
						Text: "Schema",
						Href: "/schema",
						Page: pager("schema.md"),
					},
					{
						Text: "Selectors",
						Href: "/selectors",
						Page: pager("selectors.md"),
					},
				},
			},
			{
				Text: "React",
				Href: "/react",
				Page: pager("react.md"),
			},
			{
				Text: "Guides & Concepts",
				Children: []*pdocs.Sitemap{
					{
						Text: "Caching",
						Href: "/caching",
						Page: pager("caching.md"),
					},
					{
						Text: "Dependent Queries",
						Href: "/dependent-queries",
						Page: pager("dependent.md"),
					},
					{
						Text: "Middleware",
						Href: "/middleware",
						Page: pager("mdw.md"),
					},
					{
						Text: "Loaders",
						Href: "/loaders",
						Page: pager("loaders.md"),
					},
					{
						Text: "FX",
						Href: "/fx",
						Page: pager("fx.md"),
					},
					{
						Text: "Managing Resources",
						Href: "/managing-resources",
						Page: pager("managing-resources.md"),
					},
					{
						Text: "Error Handling",
						Href: "/error-handling",
						Page: pager("error-handling.md"),
					},
					{
						Text: "Structured Concurrency",
						Href: "/structured-concurrency",
						Page: pager("structured-concurrency.md"),
					},
					{
						Text: "Supervisors",
						Href: "/supervisors",
						Page: pager("supervisors.md"),
					},
					{
						Text: "Testing",
						Href: "/testing",
						Page: pager("testing.md"),
					},
					{
						Text: "Design Philosophy",
						Href: "/design-philosophy",
						Page: pager("design-philosophy.md"),
					},
				},
			},
			{
				Text: "Resources",
				Href: "/resources",
				Page: pager("resources.md"),
			},
		},
	}

	logger := slog.Default()
	config := &pdocs.DocConfig{
		Logger:   logger,
		Sitemap:  sitemap,
		Out:      "./public",
		Tmpl:     "./tmpl",
		PageTmpl: "post.page.tmpl",
		CacheId:  strconv.Itoa(rand.Intn(10000)),
	}

	err := config.GenSite()
	if err != nil {
		panic(err)
	}
}
