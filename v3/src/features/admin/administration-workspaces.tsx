"use client";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CircleDollarSign,
  Search,
  WalletCards,
} from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Dialog,
  EmptyState,
  useToast,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";
import type { AdminCommandData, CommandPerson } from "./models";
import { AccountDialog } from "./account-dialog";

export function AdminPeopleWorkspace({
  kind,
  data,
}: {
  kind: "student" | "teacher";
  data: AdminCommandData;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = useMemo(
    () =>
      data.people.filter(
        (p) =>
          p.role === kind &&
          p.status !== "archived" &&
          (filter === "all" ||
            (filter.startsWith("class:")
              ? p.classId === filter.slice(6)
              : p.gender === filter)) &&
          normalize(p.name).includes(normalize(query)),
      ),
    [data.people, kind, filter, query],
  );
  return (
    <div className="command-page">
      <PageHead
        title={kind === "teacher" ? "الأساتذة" : "الطلاب"}
        action={
          <AccountDialog
            schoolId={data.school?.id ?? null}
            defaultRole={kind}
            data={data}
          />
        }
      />
      <div className="admin-local-tools">
        <label>
          <Search size={18} />
          <input
            aria-label="البحث المحلي"
            placeholder="ابحث بالاسم"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="التصفية"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">الكل</option>
          <option value="male">ذكور</option>
          <option value="female">إناث</option>
          {kind === "student" &&
            data.classes.map((c) => (
              <option key={c.id} value={`class:${c.id}`}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      {rows.length ? (
        <div className="admin-people-table" role="list">
          {rows.map((person) => (
            <PersonRow key={person.id} person={person} data={data} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="لا توجد نتائج"
          description="غيّر البحث أو التصفية."
        />
      )}
    </div>
  );
}

function PersonRow({
  person,
  data,
}: {
  person: CommandPerson;
  data: AdminCommandData;
}) {
  return (
    <article role="listitem">
      <span className="admin-person-avatar">{person.name.slice(0, 1)}</span>
      <div>
        <strong>{person.name}</strong>
        <small>
          {person.className ??
            (person.role === "teacher" ? "دون قسم" : "غير ملحق بقسم")}
        </small>
      </div>
      {person.monthlyAmount === 0 ? (
        <Badge tone="success">معفى · 0 DH</Badge>
      ) : (
        <Badge tone="neutral">{person.monthlyAmount ?? 0} DH</Badge>
      )}
      <PersonDialog person={person} data={data} />
    </article>
  );
}

function PersonDialog({
  person,
  data,
}: {
  person: CommandPerson;
  data: AdminCommandData;
}) {
  const [form, setForm] = useState({
    first_name: person.firstName ?? "",
    last_name: person.lastName ?? "",
    gender: person.gender ?? "unspecified",
    phone: person.phone ?? "",
    email: person.email ?? "",
    monthly_amount: String(person.monthlyAmount ?? 0),
    guardian_name: person.guardianName ?? "",
    guardian_phone: person.guardianPhone ?? "",
    class_id: person.classId ?? "",
    class_ids: person.classIds,
    teacher_ids: person.teacherIds,
  });
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  async function save() {
    setBusy(true);
    const payload: Json = {
      first_name: form.first_name,
      last_name: form.last_name,
      gender: form.gender,
      phone: form.phone,
      email: form.email,
      monthly_salary: form.monthly_amount,
      monthly_fee: form.monthly_amount,
      guardian_name: form.guardian_name,
      guardian_phone: form.guardian_phone,
    };
    const client = createClient();
    const updated = await client.rpc("admin_update_person", {
      target_user_id: person.id,
      payload,
    });
    let relationError = null;
    if (!updated.error && person.role === "student" && form.class_id)
      relationError = (
        await client.rpc("admin_set_student_relations", {
          target_student_id: person.id,
          target_class_id: form.class_id,
          target_teacher_ids: form.teacher_ids,
        })
      ).error;
    if (!updated.error && person.role === "teacher")
      relationError = (
        await client.rpc("admin_set_teacher_classes", {
          target_teacher_id: person.id,
          target_class_ids: form.class_ids,
        })
      ).error;
    setBusy(false);
    if (updated.error || relationError)
      return showToast({ title: "تعذر حفظ الملف", tone: "info" });
    showToast({ title: "تم حفظ الملف", tone: "success" });
    window.location.reload();
  }
  const related =
    person.role === "student"
      ? data.payments
          .filter((x) => x.studentId === person.id)
          .map((x) => ({
            id: x.id,
            text: `${x.month} · ${x.received} DH · ${x.status}`,
          }))
      : data.salaries
          .filter((x) => x.teacherName === person.name)
          .map((x) => ({
            id: x.id,
            text: `${x.month} · ${x.net} DH · ${x.status}`,
          }));
  return (
    <Dialog
      trigger={
        <Button size="sm" variant="secondary">
          فتح الملف
        </Button>
      }
      title={person.name}
      description="المعلومات الأساسية ثم التفاصيل عند الحاجة."
    >
      <div className="command-form">
        <div className="person-inline-stats">
          <span>
            السور <b>{person.mastered}</b>
          </span>
          <span>
            الغياب <b>{person.absences}</b>
          </span>
          <span>
            التأخر <b>{person.late}</b>
          </span>
        </div>
        <div className="form-pair">
          <label>
            الاسم
            <input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </label>
          <label>
            النسب
            <input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </label>
        </div>
        <label>
          الجنس
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          >
            <option value="unspecified">غير محدد</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </label>
        {person.role === "teacher" ? (
          <>
            <div className="form-pair">
              <label>
                الهاتف
                <input
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                البريد
                <input
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
            </div>
            <label>
              الأجر الشهري
              <input
                type="number"
                min="0"
                value={form.monthly_amount}
                onChange={(e) =>
                  setForm({ ...form, monthly_amount: e.target.value })
                }
              />
            </label>
            <fieldset className="admin-checks">
              <legend>الأقسام المكلف بها</legend>
              {data.classes.map((classRow) => (
                <label key={classRow.id}>
                  <input
                    type="checkbox"
                    checked={form.class_ids.includes(classRow.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        class_ids: e.target.checked
                          ? [...form.class_ids, classRow.id]
                          : form.class_ids.filter((id) => id !== classRow.id),
                      })
                    }
                  />
                  {classRow.name}
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <>
            <label>
              القسم
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">اختر</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="admin-checks">
              <legend>الأساتذة</legend>
              {data.people
                .filter((p) => p.role === "teacher")
                .map((teacher) => (
                  <label key={teacher.id}>
                    <input
                      type="checkbox"
                      checked={form.teacher_ids.includes(teacher.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          teacher_ids: e.target.checked
                            ? [...form.teacher_ids, teacher.id]
                            : form.teacher_ids.filter(
                                (id) => id !== teacher.id,
                              ),
                        })
                      }
                    />
                    {teacher.name}
                  </label>
                ))}
            </fieldset>
            <label>
              الولي
              <input
                value={form.guardian_name}
                onChange={(e) =>
                  setForm({ ...form, guardian_name: e.target.value })
                }
              />
            </label>
            <label>
              هاتف الولي
              <input
                dir="ltr"
                value={form.guardian_phone}
                onChange={(e) =>
                  setForm({ ...form, guardian_phone: e.target.value })
                }
              />
            </label>
            <label>
              الواجب الشهري
              <input
                type="number"
                min="0"
                value={form.monthly_amount}
                onChange={(e) =>
                  setForm({ ...form, monthly_amount: e.target.value })
                }
              />
            </label>
          </>
        )}
        <Button loading={busy} onClick={() => void save()}>
          حفظ التعديلات
        </Button>
        <PaymentDialog person={person} />
        <CredentialsDialog person={person} />
        <details>
          <summary>سجل الأداءات</summary>
          {related.length ? (
            related.map((row) => <p key={row.id}>{row.text}</p>)
          ) : (
            <p>لا توجد عمليات.</p>
          )}
        </details>
        <ButtonLink variant="quiet" href={`/admin/people/${person.id}`}>
          السجل الكامل
        </ButtonLink>
      </div>
    </Dialog>
  );
}

function CredentialsDialog({ person }: { person: CommandPerson }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  async function save() {
    setBusy(true);
    const response = await fetch(
      `/api/admin/accounts/${person.id}/credentials`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: login || undefined,
          temporaryPassword: password || undefined,
        }),
      },
    );
    setBusy(false);
    if (!response.ok)
      return showToast({ title: "تعذر تحديث الدخول", tone: "info" });
    setLogin("");
    setPassword("");
    showToast({ title: "تم تحديث بيانات الدخول", tone: "success" });
  }
  return (
    <Dialog
      trigger={<Button variant="quiet">إدارة الدخول</Button>}
      title="إدارة بيانات الدخول"
      description="لا يمكن عرض كلمة المرور الحالية. يمكن فقط تعيين كلمة مؤقتة جديدة."
    >
      <div className="command-form">
        <label>
          اسم دخول جديد
          <input
            dir="ltr"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </label>
        <label>
          كلمة مؤقتة جديدة
          <input
            dir="ltr"
            type="password"
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button
          loading={busy}
          disabled={!login && !password}
          onClick={() => void save()}
        >
          تحديث آمن
        </Button>
      </div>
    </Dialog>
  );
}

function PaymentDialog({ person }: { person: CommandPerson }) {
  const now = new Date().toISOString().slice(0, 10);
  const [month, setMonth] = useState(now.slice(0, 7));
  const [amount, setAmount] = useState(String(person.monthlyAmount ?? 0));
  const [date, setDate] = useState(now);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  async function submit() {
    setBusy(true);
    const client = createClient();
    const result =
      person.role === "student"
        ? await client.rpc("admin_record_student_payment", {
            target_student_id: person.id,
            target_period_month: `${month}-01`,
            target_amount: Number(amount),
            target_paid_on: date,
            target_note: note || null,
          })
        : await client.rpc("admin_record_teacher_salary", {
            target_teacher_id: person.id,
            target_period_month: `${month}-01`,
            target_amount: Number(amount),
            target_paid_on: date,
            target_note: note || null,
          });
    setBusy(false);
    if (result.error)
      return showToast({ title: "تعذر تسجيل العملية", tone: "info" });
    showToast({ title: "تم التسجيل وربط المالية", tone: "success" });
    window.location.reload();
  }
  return (
    <Dialog
      trigger={
        <Button variant="secondary">
          <CircleDollarSign size={17} />
          {person.role === "student" ? "تسجيل أداء" : "تسجيل أجر"}
        </Button>
      }
      title={
        person.role === "student" ? "تسجيل أداء الطالب" : "تسجيل أجر الأستاذ"
      }
      description="تُحدّث المالية آليا دون إعادة الإدخال."
    >
      <div className="command-form">
        <label>
          الشهر
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label>
          المبلغ الفعلي
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          التاريخ
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          ملاحظة
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <Button
          loading={busy}
          disabled={Number(amount) < 0}
          onClick={() => void submit()}
        >
          تأكيد العملية
        </Button>
      </div>
    </Dialog>
  );
}

export function AdminParentsWorkspace({ data }: { data: AdminCommandData }) {
  const [classFilter, setClassFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const items = data.parentFeedback.filter(
    (item) =>
      (classFilter === "all" || item.className === classFilter) &&
      (studentFilter === "all" || item.studentId === studentFilter) &&
      (!dateFilter || item.createdAt.slice(0, 10) === dateFilter),
  );
  const current = average(items.map((x) => x.average));
  const previous =
    items.length > 1 ? average(items.slice(1).map((x) => x.average)) : null;
  const trend = previous === null ? 0 : current - previous;
  return (
    <div className="command-page">
      <PageHead title="الوالدان" />
      <div className="admin-local-tools">
        <select
          aria-label="القسم"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="all">كل الأقسام</option>
          {[
            ...new Set(
              data.parentFeedback.map((item) => item.className).filter(Boolean),
            ),
          ].map((name) => (
            <option key={name} value={name!}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="الطالب"
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
        >
          <option value="all">كل الطلاب</option>
          {[
            ...new Map(
              data.parentFeedback.map((item) => [
                item.studentId,
                item.studentName,
              ]),
            ).entries(),
          ].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          aria-label="التاريخ"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>
      <section className="parent-score">
        <span>المعدل العام</span>
        <strong>{current.toFixed(1)} / 10</strong>
        {trend > 0.0001 ? (
          <ArrowUp className="up" />
        ) : trend < -0.0001 ? (
          <ArrowDown className="down" />
        ) : null}
      </section>
      {items.length ? (
        <div className="admin-feedback-table">
          <div className="feedback-head">
            <span>التاريخ</span>
            <span>الطالب</span>
            <span>القسم</span>
            <span>التنظيم</span>
            <span>التربية</span>
            <span>التعليم</span>
            <span>المنصة</span>
            <span>الأوقات</span>
            <span>المعدل</span>
          </div>
          {items.map((item) => (
            <details key={item.id}>
              <summary>
                <time>{formatDate(item.createdAt)}</time>
                <strong>{item.studentName}</strong>
                <span>{item.className ?? "—"}</span>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i}>{item.scores[i] ?? "—"}</span>
                ))}
                <b>{item.average.toFixed(1)}</b>
              </summary>
              {item.comment ? <p>{item.comment}</p> : <p>لا توجد ملاحظة.</p>}
            </details>
          ))}
        </div>
      ) : (
        <EmptyState
          title="لا توجد استبيانات"
          description="ستظهر الإجابات المرسلة هنا دون حذف التاريخ السابق."
        />
      )}
    </div>
  );
}

export function AdminFinanceWorkspace({ data }: { data: AdminCommandData }) {
  const [directionFilter, setDirectionFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const rows = data.finance.filter(
    (row) =>
      (directionFilter === "all" || row.direction === directionFilter) &&
      (!monthFilter || row.occurredOn.startsWith(monthFilter)),
  );
  const income = data.finance
    .filter((x) => x.direction === "income")
    .reduce((s, x) => s + x.amount, 0);
  const expense = data.finance
    .filter((x) => x.direction === "expense")
    .reduce((s, x) => s + x.amount, 0);
  const balance = income - expense;
  const monthly = groupFinance(data.finance);
  return (
    <div className="command-page">
      <PageHead title="المالية" action={<ManualFinance />} />
      <div className="admin-local-tools">
        <select
          aria-label="نوع العملية"
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
        >
          <option value="all">كل العمليات</option>
          <option value="income">المداخيل</option>
          <option value="expense">المصاريف</option>
        </select>
        <input
          aria-label="الشهر"
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
      </div>
      <section className="finance-kpis">
        <article>
          <span>المداخيل</span>
          <strong>{money(income)}</strong>
        </article>
        <article>
          <span>المصاريف</span>
          <strong>{money(expense)}</strong>
        </article>
        <article
          className={balance < data.financeThreshold ? "is-warning" : ""}
        >
          <span>الرصيد</span>
          <strong>{money(balance)}</strong>
        </article>
      </section>
      {balance < data.financeThreshold ? (
        <p className="finance-alert">الرصيد أقل من عتبة التنبيه المحددة.</p>
      ) : null}
      <section className="finance-chart" aria-label="حركة المالية حسب الشهر">
        {monthly.map((row) => {
          const max = Math.max(
            1,
            ...monthly.flatMap((x) => [x.income, x.expense]),
          );
          return (
            <article key={row.month}>
              <div>
                <i
                  style={{
                    height: `${Math.max(4, (row.income / max) * 100)}%`,
                  }}
                />
                <i
                  style={{
                    height: `${Math.max(4, (row.expense / max) * 100)}%`,
                  }}
                />
              </div>
              <span>{row.month.slice(5)}</span>
            </article>
          );
        })}
      </section>
      <div className="finance-ledger">
        {rows.map((row) => (
          <article key={row.id}>
            <span className={row.direction}>
              {row.direction === "income" ? "+" : "−"}
            </span>
            <div>
              <strong>{category(row.category)}</strong>
              <small>
                {row.occurredOn} · {source(row.sourceType)}
              </small>
            </div>
            <b>{money(row.amount)}</b>
          </article>
        ))}
      </div>
    </div>
  );
}

function ManualFinance() {
  const [direction, setDirection] = useState("income");
  const [amount, setAmount] = useState("");
  const [categoryValue, setCategory] = useState("donation");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  async function save() {
    setBusy(true);
    const result = await createClient().rpc("admin_create_command_record", {
      target_kind: "finance",
      payload: {
        direction,
        amount,
        category: categoryValue,
        description,
        date: new Date().toISOString().slice(0, 10),
      },
    });
    setBusy(false);
    if (result.error)
      return showToast({ title: "تعذر حفظ العملية", tone: "info" });
    showToast({ title: "تم حفظ العملية", tone: "success" });
    window.location.reload();
  }
  return (
    <Dialog
      trigger={
        <Button>
          <WalletCards size={18} />
          عملية جديدة
        </Button>
      }
      title={direction === "income" ? "مدخول جديد" : "مصروف جديد"}
    >
      <div className="command-form">
        <label>
          النوع
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="income">مدخول</option>
            <option value="expense">مصروف</option>
          </select>
        </label>
        <label>
          التصنيف
          <select
            value={categoryValue}
            onChange={(e) => setCategory(e.target.value)}
          >
            {direction === "income" ? (
              <>
                <option value="donation">تبرع</option>
                <option value="other_income">مدخول آخر</option>
              </>
            ) : (
              <>
                <option value="bill">فاتورة</option>
                <option value="purchase">شراء</option>
                <option value="maintenance">صيانة</option>
                <option value="other_expense">مصروف آخر</option>
              </>
            )}
          </select>
        </label>
        <label>
          المبلغ
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          البيان
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <Button
          loading={busy}
          disabled={Number(amount) <= 0}
          onClick={() => void save()}
        >
          حفظ
        </Button>
      </div>
    </Dialog>
  );
}

export function AdminMonitoringWorkspace({ data }: { data: AdminCommandData }) {
  const [kindFilter, setKindFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const all = [
    ...data.timeline,
    ...data.audit.map((x) => ({
      id: `a-${x.id}`,
      kind: x.entityType,
      title: action(x.action),
      detail: x.entityType,
      occurredAt: x.occurredAt,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const visible = all.filter(
    (row) =>
      (kindFilter === "all" || row.kind === kindFilter) &&
      (!dateFilter || row.occurredAt.startsWith(dateFilter)),
  );
  return (
    <div className="command-page">
      <PageHead title="المتابعة" />
      <div className="admin-local-tools">
        <select
          aria-label="نوع النشاط"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="all">كل الأنشطة</option>
          {[...new Set(all.map((row) => row.kind))].map((kind) => (
            <option key={kind} value={kind}>
              {action(kind)}
            </option>
          ))}
        </select>
        <input
          aria-label="التاريخ"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>
      <div className="monitoring-list">
        {visible.length ? (
          visible.slice(0, 100).map((row) => (
            <article key={`${row.kind}-${row.id}`}>
              <CalendarClock size={18} />
              <div>
                <strong>{row.title}</strong>
                <small>{row.detail}</small>
              </div>
              <time>{formatDate(row.occurredAt)}</time>
            </article>
          ))
        ) : (
          <EmptyState
            title="لا توجد أنشطة"
            description="سيظهر سجل العمل الحقيقي هنا."
          />
        )}
      </div>
    </div>
  );
}

function PageHead({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="admin-page-head">
      <h1>{title}</h1>
      {action}
    </header>
  );
}
function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .toLocaleLowerCase("ar");
}
function average(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function money(value: number) {
  return `${value.toLocaleString("ar-MA", { maximumFractionDigits: 2 })} DH`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-MA", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
function groupFinance(rows: AdminCommandData["finance"]) {
  const map = new Map<
    string,
    { month: string; income: number; expense: number }
  >();
  for (const row of rows) {
    const key = row.occurredOn.slice(0, 7);
    const item = map.get(key) ?? { month: key, income: 0, expense: 0 };
    item[row.direction === "income" ? "income" : "expense"] += row.amount;
    map.set(key, item);
  }
  return [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}
function category(value: string) {
  return (
    (
      {
        student_payment: "أداء طالب",
        teacher_salary: "أجر أستاذ",
        donation: "تبرع",
        bill: "فاتورة",
        purchase: "شراء",
        maintenance: "صيانة",
      } as Record<string, string>
    )[value] ?? value
  );
}
function source(value: string) {
  return (
    (
      {
        student_payment: "ملف الطالب",
        teacher_salary: "ملف الأستاذ",
        manual: "إدخال يدوي",
      } as Record<string, string>
    )[value] ?? value
  );
}
function action(value: string) {
  return (
    (
      {
        "finance.student_payment_recorded": "تم تسجيل أداء طالب",
        "finance.teacher_salary_recorded": "تم تسجيل أجر أستاذ",
        "admin.person_updated": "تم تحديث ملف",
        "account.provisioned": "تم إنشاء حساب",
      } as Record<string, string>
    )[value] ?? value
  );
}
