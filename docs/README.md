# VDA 5050 Documentation Website

This folder contains a Jekyll based website which hosts the VDA 5050 API
documentation on GitHub Pages at
[https://coatyio.github.io/vda-5050-lib.js/](https://coatyio.github.io/vda-5050-lib.js/).

## Website Content

API Documentation content is hosted in the `api` subfolder. It is generated
automatically whenever a release is created.

GitHub Pages has been configured to host the static website content from the
`/docs` folder on the master branch. This means that each time, changes to docs
subfolders are pushed on the master branch, GitHub Pages automatically
regenerates the documentation website.

## Previewing the website locally

If you'd like to preview the website locally (for example, in the process of
proposing a change):

* Install Ruby on your local machine (Jekyll is implemented in Ruby).
* Clone down the website's repository (`git clone
  https://github.com/coatyio/vda-5050-lib.js.git`).
* cd into the website's directory (`/docs`).
* Run `bundle install` to install dependencies (Jekyll, etc.). Note that if you
  are located behind a company proxy, set the environment variable `HTTP_PROXY`
  to this proxy before invoking the `bundle` commands.
* Run `bundle exec jekyll serve` to start the preview server and point your
  browser to `localhost:4000/vda-5050-lib.js/`.

## Upgrade gem dependencies

To upgrade a gem dependency to a newer version (e.g. because of a security
alert), add new gem version to `Gemfile` (e.g. `gem "nokogiri", ">= 1.10.8"`)
and run `bundle update` on the dependency (e.g. `bundle update nokogiri`).

To update all gem dependencies, run `bundle update`.

## GitHub Pages Theme

The documentation website uses the [Primer
theme](https://github.com/pages-themes/primer), a Jekyll theme for GitHub Pages.
