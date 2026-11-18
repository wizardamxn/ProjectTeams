import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "@/components/icons";
import { useCreateDoc } from "@/api/docs";
import { errorMessage } from "@/lib/api";

/** /create (optionally ?folderId=…): makes an empty doc and opens it in the editor. */
export default function Create() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateDoc();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create.mutate(
      { title: "Untitled", contentJson: { type: "doc", content: [{ type: "paragraph" }] }, folderId: params.get("folderId") || undefined },
      {
        onSuccess: (doc) => navigate(`/editor/${doc._id}`, { replace: true }),
        onError: (err) => {
          toast.error(errorMessage(err, "Couldn't create a document"));
          navigate("/documents", { replace: true });
        },
      },
    );
  }, [create, navigate, params]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" /> Creating a new document…
    </div>
  );
}
