(function () {
  "use strict";

  const STORAGE_KEY = "ku_itph_trainer_v4";
  const KU_STORAGE_KEY = "ku::itph-trainer-v4";

  function clearVariableFields() {
    document.querySelectorAll("[data-ku-var]").forEach((field) => {
      if (field.type === "checkbox" || field.type === "radio") field.checked = false;
      else field.value = "";
    });
  }

  function clearCourseStorage() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(KU_STORAGE_KEY);
    } catch (error) {}
  }

  function savedRunIsCompleted() {
    try {
      return [STORAGE_KEY, KU_STORAGE_KEY].some((key) => {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        return Boolean(saved && saved.completed);
      });
    } catch (error) {
      return false;
    }
  }

  function resetCourseFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") !== "1") return;

    clearCourseStorage();
    clearVariableFields();

    params.delete("reset");
    const query = params.toString();
    const cleanUrl = window.location.pathname + (query ? "?" + query : "") + window.location.hash;
    try { window.history.replaceState(null, "", cleanUrl); } catch (error) {}
  }

  if (savedRunIsCompleted()) {
    clearCourseStorage();
    clearVariableFields();
  }
  resetCourseFromUrl();
  const chapters = ["calc", "situations", "finish"];
  const chapterNames = {
    calc: "Посчитать ITPH по периодам",
    situations: "Разобрать ситуации",
    finish: "Собрать алгоритм"
  };
  const situationFeedback = {
    overload: "Высокий ITPH вместе с очередью и отставанием кухни указывает на перегрузку. Определи западающую зону и скорректируй расстановку.",
    underload: "Сначала сравни ITPH с прошлыми периодами. При разовом снижении дай задачи по подготовке и уборке, сохранив готовность обслуживать Гостей. Если снижение повторяется, скорректируй численность или график.",
    quality: "Нормальный ITPH не исключает проблем с качеством. Проверь процесс приготовления, сборки и соблюдение стандартов.",
    absence: "Сначала проверь, кто вышел и как загружены станции. Скорректируй расстановку с учётом навыков сотрудников и организуй замену по принятому порядку. Для ITPH используй фактические часы работающих сотрудников.",
    equipment: "Причина задержек — поломка фритюрницы. Прекрати её использование, сообщи ответственному по принятому порядку и приостанови продажу блюд, которые невозможно приготовить. Уточни у Гостей замену для уже принятых заказов.",
    trainee: "Новичку нужны показ стандарта и помощь опытного сотрудника. Проверь следующие заказы: одинаковый с планом ITPH не гарантирует правильную сборку."
  };
  const periodCount = document.querySelectorAll(".period-row").length;
  const situationCount = Object.keys(situationFeedback).length;
  const actionSteps = {
    calculate: "Посчитать ITPH по фактическим блюдам и часам сотрудников за выбранный период.",
    compare: "Сопоставить ITPH с планом и динамикой предыдущих периодов.",
    observe: "Проверить очередь, качество и загрузку рабочих станций; определить причину задержки.",
    act: "Устранить найденную причину: скорректировать расстановку или организовать помощь.",
    review: "Через час проверить ITPH, ожидание и качество; при необходимости скорректировать решение."
  };
  const correctOrder = Object.keys(actionSteps);
  const originalNavigate = window.kuNavigate;
  let state = loadState();

  function loadState() {
    const fresh = {
      unlocked: 1,
      done: [false, false, false],
      calcRows: [],
      calcRevealed: [],
      calcRowAttempts: {},
      situations: [],
      attempts: {},
      order: ["act", "calculate", "review", "observe", "compare"],
      orderDone: false,
      completed: false
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved) return fresh;
      const done = chapters.map((_, index) => Boolean(saved.done && saved.done[index]));
      const savedCalcRows = Array.isArray(saved.calcRows)
        ? [...new Set(saved.calcRows.map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < periodCount))]
        : [];
      return {
        unlocked: Math.min(Math.max(Number(saved.unlocked) || 1, 1), chapters.length),
        done,
        calcRows: savedCalcRows,
        calcRevealed: Array.isArray(saved.calcRevealed)
          ? [...new Set(saved.calcRevealed.map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < periodCount))]
          : [],
        calcRowAttempts: Object.fromEntries(
          Object.entries(saved.calcRowAttempts || {})
            .filter(([index]) => Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < periodCount)
            .map(([index, count]) => [index, Math.min(Math.max(Number(count) || 0, 0), 3)])
        ),
        situations: Array.isArray(saved.situations) ? saved.situations.filter(id => situationFeedback[id]) : [],
        attempts: Object.fromEntries(
          Object.entries(saved.attempts || {})
            .filter(([id]) => situationFeedback[id])
            .map(([id, count]) => [id, Math.min(Math.max(Number(count) || 0, 0), 3)])
        ),
        order: Array.isArray(saved.order) && saved.order.length === correctOrder.length && new Set(saved.order).size === correctOrder.length && saved.order.every(id => correctOrder.includes(id)) ? saved.order : fresh.order,
        orderDone: Boolean(saved.orderDone),
        completed: Boolean(saved.completed && saved.orderDone)
      };
    } catch (error) {
      return fresh;
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) {}
  }

  function markExerciseDone(id) {
    if (window.KU && window.KU.progress) window.KU.progress.markDone(id);
  }

  function syncUi() {
    chapters.forEach((chapter, index) => {
      const card = document.getElementById("ku-home-card-" + (index + 1));
      if (!card) return;
      card.classList.toggle("locked", index >= state.unlocked);
      card.classList.toggle("done", state.done[index]);
      card.setAttribute("aria-disabled", String(index >= state.unlocked));
    });
    const calcNext = document.getElementById("next-calc");
    const situationsNext = document.getElementById("next-situations");
    if (calcNext) calcNext.disabled = !state.done[0];
    if (situationsNext) situationsNext.disabled = !state.done[1];
    restoreCalculation();
    restoreSituations();
    restoreOrder();
    if (state.completed) showCompleted();
  }

  function unlockAfter(chapter) {
    const index = chapters.indexOf(chapter);
    if (index < 0) return;
    state.done[index] = true;
    state.unlocked = Math.max(state.unlocked, Math.min(index + 2, chapters.length));
    saveState();
    syncUi();
  }

  window.kuNavigate = function (pageId) {
    const index = chapters.indexOf(pageId);
    if (index >= state.unlocked) return;
    originalNavigate(pageId);
    const title = document.getElementById("ku-course-title");
    if (title) title.textContent = chapterNames[pageId] || "";
    syncUi();
  };

  window.startCourse = function () {
    window.kuNavigate("calc");
  };

  function closeButton() {
    return '<button class="feedback-close" type="button" aria-label="Закрыть обратную связь" onclick="closeFeedback(this)"><svg class="ku-ico s"><use href="#i-x"/></svg></button>';
  }

  function showFeedback(id, correct, message) {
    const feedback = document.getElementById(id);
    if (!feedback) return;
    feedback.className = "ku-feedback show " + (correct ? "correct" : "incorrect");
    feedback.innerHTML = '<span class="ku-fb-msg">' + message + "</span>" + closeButton();
  }

  window.closeFeedback = function (button) {
    const feedback = button.closest(".ku-feedback");
    if (feedback) feedback.classList.remove("show");
  };

  function parseNumber(value) {
    return Number(String(value).trim().replace(",", "."));
  }

  function setPeriodFieldsLocked(row, locked) {
    row.querySelector(".period-value").readOnly = locked;
    row.querySelector(".period-logic").disabled = locked;
  }

  function setSavedFieldValue(field, value) {
    if (field.value === value) return;
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function revealPeriodAnswer(row) {
    setSavedFieldValue(row.querySelector(".period-value"), String(row.dataset.answer));
    setSavedFieldValue(row.querySelector(".period-logic"), row.dataset.model);
    setPeriodFieldsLocked(row, true);
  }

  function restoreCalculation() {
    const rows = [...document.querySelectorAll(".period-row")];
    const currentIndex = rows.findIndex((_, index) => !state.calcRows.includes(index));

    rows.forEach((row, index) => {
      const completed = state.calcRows.includes(index);
      const revealed = state.calcRevealed.includes(index);
      const locked = !completed && index !== currentIndex;

      row.classList.toggle("is-locked", locked);
      row.classList.toggle("correct", completed && !revealed);
      row.classList.toggle("revealed", revealed);
      row.classList.remove("incorrect");
      setPeriodFieldsLocked(row, completed || locked);
      if (completed) revealPeriodAnswer(row);
      updateSelectedText(row.querySelector(".period-logic"));
    });

    const counter = document.getElementById("calc-period-count");
    if (counter) counter.textContent = state.calcRows.length + " / " + periodCount;
    const checkButton = document.getElementById("check-calc");
    if (checkButton) {
      checkButton.disabled = currentIndex < 0;
      checkButton.textContent = currentIndex < 0 ? "Все периоды разобраны" : "Проверить период";
    }
  }

  function resolvePeriod(row, index, revealed) {
    if (!state.calcRows.includes(index)) state.calcRows.push(index);
    state.calcRows.sort((a, b) => a - b);
    if (revealed && !state.calcRevealed.includes(index)) state.calcRevealed.push(index);
    setPeriodFieldsLocked(row, true);
    const allDone = state.calcRows.length === periodCount;
    if (allDone) {
      markExerciseDone("calc-periods");
      unlockAfter("calc");
    } else {
      saveState();
      syncUi();
    }
    return allDone;
  }

  window.checkPeriodCalculations = function () {
    const rows = [...document.querySelectorAll(".period-row")];
    const currentIndex = rows.findIndex((_, index) => !state.calcRows.includes(index));
    if (currentIndex < 0) return;

    const row = rows[currentIndex];
    const answer = Number(row.dataset.answer);
    const value = parseNumber(row.querySelector(".period-value").value);
    const decision = row.querySelector(".period-logic").value.trim();
    const valueOk = Number.isFinite(value) && Math.abs(value - answer) < 0.01;
    const decisionReady = decision === row.dataset.model;

    row.classList.toggle("correct", valueOk && decisionReady);
    row.classList.toggle("incorrect", !valueOk || !decisionReady);

    if (valueOk && decisionReady) {
      const allDone = resolvePeriod(row, currentIndex, false);
      showFeedback(
        "calc-feedback",
        true,
        allDone
          ? "<strong>Все пять периодов разобраны.</strong> Можно переходить к ситуациям."
          : "<strong>Верно.</strong> Расчёт и выбранное действие подходят к ситуации. Следующий период открыт."
      );
      return;
    }

    const attemptKey = String(currentIndex);
    const attempts = Math.min((Number(state.calcRowAttempts[attemptKey]) || 0) + 1, 3);
    state.calcRowAttempts[attemptKey] = attempts;
    saveState();

    if (attempts >= 3) {
      const allDone = resolvePeriod(row, currentIndex, true);
      showFeedback(
        "calc-feedback",
        true,
        "<strong>Разбор после трёх попыток.</strong> " + row.dataset.setup + " = " + row.dataset.answer + ". Эталонный расчёт и решение подставлены в поля. " + (allDone ? "Можно переходить к ситуациям." : "Следующий период открыт.")
      );
      return;
    }

    const hints = [];
    if (!valueOk) {
      hints.push(
        attempts === 1
          ? "Формула: проданные блюда ÷ часы сотрудников за период = ITPH."
          : "Подставь данные так: " + row.dataset.setup + ". Затем выполни деление."
      );
    }
    if (!decisionReady) {
      hints.push(decision ? "Выбранное действие не подходит. Сравни ITPH с планом и учти очередь, качество и динамику нагрузки." : "Выбери вывод и первое действие из списка.");
    }
    const remaining = 3 - attempts;
    const attemptsText = remaining === 1 ? "Осталась 1 попытка." : "Осталось " + remaining + " попытки.";
    showFeedback("calc-feedback", false, "<strong>Есть неточности.</strong> " + hints.join(" ") + " " + attemptsText);
  };  function restoreSituations() {
    const cards = [...document.querySelectorAll("[data-situation]")];
    const currentIndex = cards.findIndex(card => !state.situations.includes(card.dataset.situation));

    cards.forEach((card, index) => {
      const solved = state.situations.includes(card.dataset.situation);
      const locked = !solved && index !== currentIndex;
      card.classList.toggle("solved", solved);
      card.classList.toggle("is-locked", locked);
      card.querySelectorAll(".situation-choice").forEach(button => {
        button.disabled = solved || locked;
        button.classList.toggle("correct", solved && button.dataset.correct === "1");
      });
    });
    const counter = document.getElementById("situations-count");
    if (counter) counter.textContent = state.situations.length + " / " + situationCount;
  }
  function resolveSituation(card, id, feedbackId, message) {
    if (!state.situations.includes(id)) state.situations.push(id);
    card.classList.add("solved");
    card.querySelectorAll(".situation-choice").forEach(choice => {
      choice.disabled = true;
      choice.classList.toggle("correct", choice.dataset.correct === "1");
    });
    markExerciseDone("situation-" + id);
    showFeedback(feedbackId, true, message);
    if (state.situations.length === situationCount) unlockAfter("situations");
    else {
      saveState();
      syncUi();
    }
  }

  function answerSituation(button) {
    const card = button.closest("[data-situation]");
    if (!card || card.classList.contains("solved") || card.classList.contains("is-locked") || !state.done[0]) return;
    const id = card.dataset.situation;
    const feedbackId = "situation-" + id + "-feedback";

    if (button.dataset.correct !== "1") {
      const attempts = Math.min((Number(state.attempts[id]) || 0) + 1, 3);
      state.attempts[id] = attempts;
      saveState();
      button.classList.add("wrong");
      setTimeout(() => button.classList.remove("wrong"), 500);

      if (attempts >= 3) {
        resolveSituation(
          card,
          id,
          feedbackId,
          "<strong>Разбор после трёх попыток.</strong> " + situationFeedback[id] + " Правильный вариант отмечен — можно идти дальше."
        );
        return;
      }

      const remaining = 3 - attempts;
      const attemptsText = remaining === 1 ? "Осталась 1 попытка." : "Осталось " + remaining + " попытки.";
      showFeedback(
        feedbackId,
        false,
        "<strong>Не совсем.</strong> Сопоставь факт с планом, а затем учти загрузку команды, состояние оборудования и опыт Гостей. " + attemptsText
      );
      return;
    }

    resolveSituation(card, id, feedbackId, "<strong>Верно.</strong> " + situationFeedback[id]);
  }
  function showCompleted() {
    const button = document.getElementById("complete-course");
    const message = document.getElementById("complete-state");
    if (button) {
      button.disabled = true;
      button.textContent = "Курс завершён";
    }
    if (message) message.classList.add("show");
  }

  window.completeCourse = function () {
    if (!state.done[0] || !state.done[1] || !state.orderDone) return;
    state.done[2] = true;
    state.completed = true;
    saveState();
    syncUi();
  };

  function resetCompletedRunFromScorm(event) {
    const runtimeState = event.detail;
    if (!runtimeState || !runtimeState.completed) return;

    runtimeState.unlocked = 1;
    runtimeState.done = {};
    runtimeState.vars = {};
    runtimeState.completed = false;
    clearCourseStorage();
    clearVariableFields();
    document.querySelectorAll("[data-ku-id]").forEach((exercise) => {
      exercise.classList.remove("is-done");
    });
    document.querySelectorAll("[data-ku-complete]").forEach((button) => {
      button.classList.remove("is-completed");
    });

    state = loadState();
    if (window.KU && window.KU.save) window.KU.save();
    syncUi();
  }

  document.addEventListener("ku:ready", function (event) {
    resetCompletedRunFromScorm(event);
    syncUi();
  });

  function updateSelectedText(select) {
    const caption = select.parentElement.querySelector(".period-selection");
    if (caption) caption.textContent = select.value ? select.options[select.selectedIndex].textContent : "";
  }

  function beginOrderDrag(event, item, list) {
    if (state.orderDone || !state.done[1] || event.button !== 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const stepId = item.dataset.step;
    item.classList.add("is-dragging");
    list.setPointerCapture(pointerId);
    const announce = document.getElementById("order-announcement");
    function move(e) {
      if (e.pointerId !== pointerId) return;
      const before = [...list.children].find(card => {
        if (card === item) return false;
        const rect = card.getBoundingClientRect();
        return e.clientY < rect.top + rect.height / 2;
      });
      list.insertBefore(item, before || null);
      if (e.clientY < 100) window.scrollBy(0, -18);
      else if (e.clientY > window.innerHeight - 100) window.scrollBy(0, 18);
      announce.textContent = "Позиция: " + ([...list.children].indexOf(item) + 1) + " из " + state.order.length;
    }
    function finish(e) {
      if (e.pointerId !== pointerId) return;
      list.removeEventListener("pointermove", move);
      list.removeEventListener("pointerup", finish);
      list.removeEventListener("pointercancel", cancel);
      list.removeEventListener("lostpointercapture", cancel);
      if (list.hasPointerCapture(pointerId)) list.releasePointerCapture(pointerId);
      if (e.type === "pointerup") {
        state.order = [...list.children].map(card => card.dataset.step);
        saveState();
        document.getElementById("order-feedback").classList.remove("show");
      }
      restoreOrder();
      list.querySelector('[data-step="' + stepId + '"] .action-order__handle').focus({ preventScroll: true });
      announce.textContent = e.type === "pointerup" ? "Шаг перемещён на позицию " + (state.order.indexOf(stepId) + 1) + "." : "Перемещение отменено.";
    }
    function cancel(e) { finish(e); }
    list.addEventListener("pointermove", move);
    list.addEventListener("pointerup", finish);
    list.addEventListener("pointercancel", cancel);
    list.addEventListener("lostpointercapture", cancel);
  }

  function restoreOrder() {
    const list = document.getElementById("action-order");
    list.innerHTML = "";
    state.order.forEach((id, index) => {
      const item = document.createElement("li");
      item.dataset.step = id;
      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "action-order__handle";
      handle.textContent = "⠿";
      handle.setAttribute("aria-label", "Перетащить шаг. Для клавиатуры используй кнопки выше и ниже: " + actionSteps[id]);
      handle.disabled = state.orderDone || !state.done[1];
      handle.addEventListener("pointerdown", event => beginOrderDrag(event, item, list));
      item.appendChild(handle);
      const label = document.createElement("span");
      label.className = "action-order__text";
      label.textContent = actionSteps[id];
      item.appendChild(label);
      const controls = document.createElement("div");
      controls.className = "action-order__buttons";
      [-1, 1].forEach(direction => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ku-btn ghost";
        button.textContent = direction < 0 ? "↑ Выше" : "↓ Ниже";
        button.setAttribute("aria-label", button.textContent + ": " + actionSteps[id]);
        button.dataset.step = id;
        button.dataset.direction = direction;
        button.disabled = state.orderDone || !state.done[1] || index + direction < 0 || index + direction >= state.order.length;
        button.addEventListener("click", () => {
          const target = index + direction;
          [state.order[index], state.order[target]] = [state.order[target], state.order[index]];
          saveState();
          restoreOrder();
          document.getElementById("order-feedback").classList.remove("show");
          const movedButtons = [...list.querySelectorAll("button")].filter(b => b.dataset.step === id && !b.disabled);
          const focusTarget = movedButtons.find(b => b.dataset.direction === String(direction)) || movedButtons[0];
          if (focusTarget) focusTarget.focus();
        });
        controls.appendChild(button);
      });
      item.appendChild(controls);
      list.appendChild(item);
    });
    document.getElementById("algorithm-reference").hidden = !state.orderDone;
    document.getElementById("check-order").disabled = state.orderDone || !state.done[1];
    document.getElementById("complete-course").disabled = !state.done[0] || !state.done[1] || !state.orderDone || state.completed;
  }

  window.checkActionOrder = function () {
    if (!state.done[1] || state.orderDone) return;
    const firstWrong = state.order.findIndex((id, index) => id !== correctOrder[index]);
    if (firstWrong !== -1) {
      showFeedback("order-feedback", false, "<strong>Проверь шаг " + (firstWrong + 1) + ".</strong> Сначала нужны расчёт и сравнение с планом, затем наблюдение и действие. Оценка результата — в конце.");
      return;
    }
    state.orderDone = true;
    markExerciseDone("action-order");
    saveState();
    syncUi();
    showFeedback("order-feedback", true, "<strong>Верно.</strong> Рассчитай → сопоставь → найди причину → действуй → проверь результат. Теперь можно завершить курс.");
  };

  document.addEventListener("change", function (event) {
    if (event.target.matches(".period-logic")) updateSelectedText(event.target);
  });

  function closeCourseWindow() {
    window.setTimeout(function () {
      let target = window;
      try {
        if (window.top && window.top !== window) target = window.top;
        target.close();
      } catch (error) {
        try { window.close(); } catch (closeError) {}
      }

      window.setTimeout(function () {
        try {
          if (target.closed) return;
        } catch (error) {}
        const message = document.getElementById("complete-state");
        if (message) {
          message.textContent = "Курс завершён. Теперь можно закрыть это окно.";
          message.classList.add("show");
        }
      }, 500);
    }, 350);
  }

  document.addEventListener("ku:completed", closeCourseWindow);

  document.addEventListener("click", function (event) {
    const choice = event.target.closest(".situation-choice");
    if (choice && !choice.disabled) answerSituation(choice);
  });

  document.addEventListener("DOMContentLoaded", function () {
    window.kuSetAudience("ms");
    window.kuSetDirection("lyudi");
    window.kuSetTheme("light");
    syncUi();
  });
})();
