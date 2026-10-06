/**
 * Careers open roles: live Rippling job listing.
 * Mounts the complete interface inside #ctx-jobs and performs one public GET
 * on every page load. No authentication or credentialed fetch is used.
 */
(function careersJobsListing(globalScope, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (!globalScope || !globalScope.document) return;

  globalScope.ContextualJobsListing = api;

  if (globalScope.document.readyState === "loading") {
    globalScope.document.addEventListener(
      "DOMContentLoaded",
      function () {
        api.init(globalScope.document);
      },
      { once: true },
    );
  } else {
    api.init(globalScope.document);
  }
})(
  typeof window !== "undefined" ? window : null,
  function createCareersJobsListing() {
    "use strict";

    var ENDPOINT =
      "https://api.rippling.com/platform/api/ats/v1/board/contextual-careers/jobs";
    var BOARD_URL = "https://ats.rippling.com/contextual-careers/jobs";
    var ARROW_URL =
      typeof document !== "undefined" && document.currentScript
        ? new URL("../global/pe-c8-arrow.svg", document.currentScript.src).href
        : "";

    function asText(value) {
      return typeof value === "string" ? value.trim() : "";
    }

    function parseWorkLocation(label) {
      var source = asText(label);
      var match = source.match(/^(.+?)\s*\(([^()]*)\)\s*$/);

      if (!match) {
        return {
          jobType: source || "Not specified",
          location: "Not specified",
        };
      }

      return {
        jobType: asText(match[1]) || "Not specified",
        location: asText(match[2]) || "Not specified",
      };
    }

    function safeExternalUrl(value, fallback) {
      try {
        var parsed = new URL(asText(value));
        if (parsed.protocol === "https:" || parsed.protocol === "http:")
          return parsed.href;
      } catch (error) {
        // The public board is used when a returned application URL is malformed.
      }

      return fallback;
    }

    function normalizeJob(job, index) {
      var source = job && typeof job === "object" ? job : {};
      var department =
        source.department && typeof source.department === "object"
          ? asText(source.department.label)
          : "";
      var workLocation =
        source.workLocation && typeof source.workLocation === "object"
          ? asText(source.workLocation.label)
          : "";
      var parsedLocation = parseWorkLocation(workLocation);

      return {
        id: asText(source.uuid) || "ctx-job-" + index,
        title: asText(source.name) || "Untitled role",
        team: department || "Not specified",
        jobType: parsedLocation.jobType,
        location: parsedLocation.location,
        url: safeExternalUrl(source.url, BOARD_URL),
      };
    }

    function uniqueSorted(jobs, property) {
      var seen = Object.create(null);

      return jobs
        .reduce(function (values, job) {
          var value = job[property];
          if (!seen[value]) {
            seen[value] = true;
            values.push(value);
          }
          return values;
        }, [])
        .sort(function (a, b) {
          return a.localeCompare(b, undefined, { sensitivity: "base" });
        });
    }

    function filterJobs(jobs, filters) {
      return jobs.filter(function (job) {
        return (
          (!filters.team || job.team === filters.team) &&
          (!filters.jobType || job.jobType === filters.jobType) &&
          (!filters.location || job.location === filters.location)
        );
      });
    }

    function element(documentRef, tagName, className, text) {
      var node = documentRef.createElement(tagName);
      if (className) node.className = className;
      if (typeof text === "string") node.textContent = text;
      return node;
    }

    function renderState(documentRef, mount, options) {
      var state = element(documentRef, "div", "ctx-jobs__state");
      var title = element(
        documentRef,
        "h3",
        "ctx-jobs__state-title",
        options.title,
      );

      state.setAttribute("role", options.role || "status");
      state.appendChild(title);

      if (options.copy) {
        state.appendChild(
          element(documentRef, "p", "ctx-jobs__state-copy", options.copy),
        );
      }

      if (options.link) {
        var link = element(
          documentRef,
          "a",
          "ctx-jobs__state-link",
          options.link.label,
        );
        link.href = options.link.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        state.appendChild(link);
      }

      if (options.action) {
        var button = element(
          documentRef,
          "button",
          "ctx-jobs__clear",
          options.action.label,
        );
        button.type = "button";
        button.addEventListener("click", options.action.onClick);
        state.appendChild(button);
      }

      mount.replaceChildren(state);
    }

    function createFilter(documentRef, config) {
      var label = element(documentRef, "label", "ctx-jobs__filter-label");
      var trigger = element(documentRef, "button", "ctx-jobs__select");
      var labelText = element(
        documentRef,
        "span",
        "ctx-jobs__filter-name",
        config.label + ":",
      );
      var valueText = element(
        documentRef,
        "span",
        "ctx-jobs__filter-value",
        config.allLabel,
      );
      var options = element(documentRef, "div", "ctx-jobs__options");
      var control = {
        element: label,
        trigger: trigger,
        valueText: valueText,
        currentValue: "",
        options: [],
        defaultLabel: config.allLabel,
        name: config.name,
      };

      trigger.type = "button";
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.appendChild(labelText);
      trigger.appendChild(valueText);
      options.hidden = true;
      options.setAttribute("role", "listbox");

      function closeAndReturnFocus() {
        trigger.setAttribute("aria-expanded", "false");
        options.hidden = true;
        if (options.contains(documentRef.activeElement)) trigger.focus();
      }

      var allOption = element(documentRef, "button", "ctx-jobs__option");
      var allLabel = element(documentRef, "span", "ctx-jobs__option-label");
      var allValue = element(documentRef, "span", "ctx-jobs__option-value");

      allOption.type = "button";
      allOption.setAttribute("role", "option");
      allOption.setAttribute("aria-selected", "true");
      allOption.dataset.value = "";
      allOption.dataset.label = config.allLabel;
      allLabel.textContent = config.label ? config.label + ":" : "";
      allValue.textContent = config.allLabel;
      allOption.appendChild(allLabel);
      allOption.appendChild(allValue);
      allOption.addEventListener("click", function () {
        control.currentValue = "";
        control.valueText.textContent = config.allLabel;
        closeAndReturnFocus();
        control.options.forEach(function (option) {
          option.setAttribute("aria-selected", "false");
        });
        allOption.setAttribute("aria-selected", "true");
        if (config.onChange) config.onChange();
      });
      options.appendChild(allOption);
      control.options.push(allOption);

      config.options.forEach(function (value) {
        var option = element(documentRef, "button", "ctx-jobs__option");
        var optionLabel = element(
          documentRef,
          "span",
          "ctx-jobs__option-label",
        );
        var optionValue = element(
          documentRef,
          "span",
          "ctx-jobs__option-value",
        );

        option.type = "button";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.dataset.value = value;
        option.dataset.label = value;
        optionLabel.textContent = config.label ? config.label + ":" : "";
        optionValue.textContent = value;
        option.appendChild(optionLabel);
        option.appendChild(optionValue);
        option.addEventListener("click", function () {
          control.currentValue = value;
          control.valueText.textContent = value;
          closeAndReturnFocus();
          control.options.forEach(function (item) {
            item.setAttribute(
              "aria-selected",
              item === option ? "true" : "false",
            );
          });
          if (config.onChange) config.onChange();
        });
        options.appendChild(option);
        control.options.push(option);
      });

      label.appendChild(trigger);
      label.appendChild(options);

      label.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeAndReturnFocus();
          return;
        }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();

        var index = control.options.indexOf(documentRef.activeElement);
        if (index < 0) {
          if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
          (options.querySelector('[aria-selected="true"]') || allOption).focus();
          return;
        }
        var step = event.key === "ArrowDown" ? 1 : -1;
        var count = control.options.length;
        control.options[(index + step + count) % count].focus();
      });

      label.addEventListener("focusout", function (event) {
        if (label.contains(event.relatedTarget)) return;
        trigger.setAttribute("aria-expanded", "false");
        options.hidden = true;
      });

      return control;
    }

    function createJobRow(documentRef, job) {
      var row = element(documentRef, "article", "ctx-jobs__row");
      var title = element(documentRef, "h3", "ctx-jobs__title", job.title);
      var meta = element(documentRef, "div", "ctx-jobs__meta");
      var apply = element(documentRef, "a", "ctx-jobs__apply");
      var arrow = element(documentRef, "img", "ctx-jobs__apply-icon");

      row.setAttribute("role", "listitem");
      row.setAttribute("data-job-id", job.id);

      [job.team, job.jobType, job.location].forEach(function (value) {
        meta.appendChild(element(documentRef, "span", "ctx-jobs__chip", value));
      });

      arrow.src = ARROW_URL;
      arrow.alt = "";
      arrow.setAttribute("aria-hidden", "true");
      apply.href = job.url;
      apply.target = "_blank";
      apply.rel = "noopener noreferrer";
      apply.setAttribute(
        "aria-label",
        "Apply for " + job.title + " (opens in a new tab)",
      );
      apply.appendChild(arrow);
      apply.appendChild(documentRef.createTextNode("Apply"));

      row.appendChild(title);
      row.appendChild(meta);
      row.appendChild(apply);
      return row;
    }

    function renderListing(documentRef, mount, jobs) {
      var shell = element(documentRef, "div", "ctx-jobs__shell");
      var filters = element(documentRef, "form", "ctx-jobs__filters");
      var results = element(documentRef, "div", "ctx-jobs__results");
      var controls = {
        team: createFilter(documentRef, {
          name: "team",
          label: "Team",
          allLabel: "All teams",
          options: uniqueSorted(jobs, "team"),
          onChange: function () {
            renderResults();
          },
        }),
        location: createFilter(documentRef, {
          name: "location",
          label: "Location",
          allLabel: "All locations",
          options: uniqueSorted(jobs, "location"),
          onChange: function () {
            renderResults();
          },
        }),
        jobType: createFilter(documentRef, {
          name: "job-type",
          label: "Job type",
          allLabel: "All job types",
          options: uniqueSorted(jobs, "jobType"),
          onChange: function () {
            renderResults();
          },
        }),
      };

      function closeAllFilters(exceptKey) {
        Object.keys(controls).forEach(function (key) {
          if (key === exceptKey) return;
          controls[key].trigger.setAttribute("aria-expanded", "false");
          controls[key].optionsParent =
            controls[key].optionsParent ||
            controls[key].element.querySelector(".ctx-jobs__options");
          if (controls[key].optionsParent) {
            controls[key].optionsParent.hidden = true;
          }
        });
      }

      filters.setAttribute("aria-label", "Filter open roles");
      filters.addEventListener("submit", function (event) {
        event.preventDefault();
      });
      filters.appendChild(controls.team.element);
      filters.appendChild(controls.location.element);
      filters.appendChild(controls.jobType.element);
      shell.appendChild(filters);
      shell.appendChild(results);
      mount.replaceChildren(shell);

      Object.keys(controls).forEach(function (key) {
        var control = controls[key];
        var optionsWrapper =
          control.element.querySelector(".ctx-jobs__options");
        control.optionsParent = optionsWrapper;

        control.trigger.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          var isOpen = control.trigger.getAttribute("aria-expanded") === "true";
          closeAllFilters(key);
          control.trigger.setAttribute("aria-expanded", String(!isOpen));
          if (optionsWrapper) {
            optionsWrapper.hidden = isOpen;
          }
        });
      });

      documentRef.addEventListener("click", function (event) {
        var target = event.target;
        if (!target) return;
        var insideFilter = target.closest(".ctx-jobs__filter-label");
        if (!insideFilter) {
          closeAllFilters();
          Object.keys(controls).forEach(function (key) {
            controls[key].trigger.setAttribute("aria-expanded", "false");
            if (controls[key].optionsParent) {
              controls[key].optionsParent.hidden = true;
            }
          });
        }
      });

      function currentFilters() {
        return {
          team: controls.team.currentValue,
          location: controls.location.currentValue,
          jobType: controls.jobType.currentValue,
        };
      }

      function clearFilters() {
        controls.team.currentValue = "";
        controls.location.currentValue = "";
        controls.jobType.currentValue = "";
        controls.team.valueText.textContent = controls.team.defaultLabel;
        controls.location.valueText.textContent =
          controls.location.defaultLabel;
        controls.jobType.valueText.textContent = controls.jobType.defaultLabel;
        controls.team.options.forEach(function (option) {
          option.setAttribute(
            "aria-selected",
            option.dataset.value === "" ? "true" : "false",
          );
        });
        controls.location.options.forEach(function (option) {
          option.setAttribute(
            "aria-selected",
            option.dataset.value === "" ? "true" : "false",
          );
        });
        controls.jobType.options.forEach(function (option) {
          option.setAttribute(
            "aria-selected",
            option.dataset.value === "" ? "true" : "false",
          );
        });
        renderResults();
        controls.team.trigger.focus();
      }

      function renderResults() {
        var visibleJobs = filterJobs(jobs, currentFilters());

        if (!visibleJobs.length) {
          renderState(documentRef, results, {
            title: "No roles match these filters.",
            copy: "Try another team, job type or location.",
            action: { label: "Clear filters", onClick: clearFilters },
          });
          return;
        }

        var list = element(documentRef, "div", "ctx-jobs__list");
        list.setAttribute("role", "list");
        visibleJobs.forEach(function (job) {
          list.appendChild(createJobRow(documentRef, job));
        });
        results.replaceChildren(list);
      }

      renderResults();
    }

    function init(documentRef) {
      var mount = documentRef.getElementById("ctx-jobs");
      if (!mount || mount.getAttribute("data-ctx-jobs-initialized") === "true")
        return;

      var endpoint =
        asText(mount.getAttribute("data-ctx-jobs-endpoint")) || ENDPOINT;
      mount.setAttribute("data-ctx-jobs-initialized", "true");
      mount.setAttribute("aria-live", "polite");
      mount.setAttribute("aria-busy", "true");

      renderState(documentRef, mount, {
        title: "Loading open roles…",
        copy: "This should only take a moment.",
      });

      return fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "omit",
        cache: "no-store",
      })
        .then(function (response) {
          if (!response.ok)
            throw new Error("Rippling returned HTTP " + response.status);
          return response.json();
        })
        .then(function (payload) {
          if (!Array.isArray(payload))
            throw new Error("Unexpected Rippling response shape");

          mount.setAttribute("aria-busy", "false");

          if (!payload.length) {
            renderState(documentRef, mount, {
              title: "No open roles right now.",
              copy: "Please check back soon for new opportunities.",
            });
            return;
          }

          renderListing(documentRef, mount, payload.map(normalizeJob));
        })
        .catch(function (error) {
          mount.setAttribute("aria-busy", "false");
          mount.setAttribute("data-ctx-jobs-error", "true");
          renderState(documentRef, mount, {
            title: "Open roles are temporarily unavailable.",
            copy: "You can still view and apply for roles on our Rippling job board.",
            role: "alert",
            link: { label: "View open roles on Rippling", href: BOARD_URL },
          });

          if (typeof console !== "undefined" && console.error) {
            console.error("[careers-jobs-listing] Unable to load jobs.", error);
          }
        });
    }

    return {
      init: init,
      parseWorkLocation: parseWorkLocation,
      normalizeJob: normalizeJob,
      filterJobs: filterJobs,
      uniqueSorted: uniqueSorted,
    };
  },
);
