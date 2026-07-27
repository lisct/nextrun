"use server";

import { createClient } from "@/lib/supabase/server";
import { PaymentPlan } from "@/types";
import { revalidatePath } from "next/cache";

export async function addPlayer(
  name: string,
  phone: string | null,
  paymentPlan: PaymentPlan,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("players")
    .insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      payment_plan: paymentPlan,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/players");
  return data;
}

export async function updatePlayer(
  id: string,
  name: string,
  phone: string | null,
  paymentPlan: PaymentPlan,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("players")
    .update({
      name: name.trim(),
      phone: phone?.trim() || null,
      payment_plan: paymentPlan,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/admin/players");
  return data;
}

export async function deactivatePlayer(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("players")
    .update({ is_active: false })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/players");
}
