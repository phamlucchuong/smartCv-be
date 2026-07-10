import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useGetAllCandidates } from "@smart-cv/api";
import type { UserModels } from "@smart-cv/api";
import { Button } from "@smart-cv/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@smart-cv/ui";
import {
  Lock,
  Unlock,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Search,
  Sparkles,
  X,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "../../store/useAuthStore";

type CandidateItem = UserModels.CandidateResponse;

export const Route = createFileRoute("/employer/cv-search")({
  head: () => ({ meta: [{ title: "Tìm kiếm CV Database — SmartCV" }] }),
  component: CvSearchPage,
});

function CvSearchPage() {
  const { isAuthenticated, role } = useAuthStore();
  const isRecruiter = isAuthenticated && (role?.includes("RECRUITER") ?? false);

  const [keyword, setKeyword] = useState("");
  const [skill, setSkill] = useState("");
  const [experience, setExperience] = useState("");
  const [location, setLocation] = useState("");
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<CandidateItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const { data: candidatesData, isLoading } = useGetAllCandidates(
    { page: 1, size: 100 },
    { query: { enabled: isRecruiter } },
  );

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentPage(1);
  }, [keyword, skill, experience, location]);

  const filteredCandidates = useMemo(() => {
    const allCandidates = candidatesData?.data?.items ?? [];
    return allCandidates.filter((c) => {
      const isLocked = !unlockedIds.includes(c.id ?? "");
      const displayName = isLocked ? "Ứng viên ***" : (c.fullName ?? "");

      const matchesKeyword =
        !keyword.trim() ||
        displayName.toLowerCase().includes(keyword.toLowerCase()) ||
        (c.title ?? "").toLowerCase().includes(keyword.toLowerCase());

      const matchesSkill =
        !skill.trim() ||
        (c.skills ?? []).some((s) =>
          s.toLowerCase().includes(skill.toLowerCase()),
        );

      const expStr =
        c.yearsOfExperience != null ? `${c.yearsOfExperience}` : "";
      const matchesExperience =
        !experience.trim() || expStr.includes(experience.trim());

      const matchesLocation =
        !location.trim() ||
        (c.address ?? "").toLowerCase().includes(location.toLowerCase());

      return matchesKeyword && matchesSkill && matchesExperience && matchesLocation;
    });
  }, [candidatesData, keyword, skill, experience, location, unlockedIds]);

  const totalPages = Math.ceil(filteredCandidates.length / ITEMS_PER_PAGE);
  const paginatedCandidates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCandidates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredCandidates, currentPage]);

  const handleUnlock = (candidateId: string) => {
    if (!unlockedIds.includes(candidateId)) {
      setUnlockedIds((prev) => [...prev, candidateId]);
      toast.success("Mở khóa thông tin ứng viên thành công!");
    }
  };

  const handleOpenModal = (candidate: CandidateItem) => {
    setSelectedCandidate(candidate);
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setKeyword("");
    setSkill("");
    setExperience("");
    setLocation("");
    toast.info("Đã xóa tất cả bộ lọc");
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto py-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border/60 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="size-6 text-primary" />
            Tìm kiếm CV Database
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tìm kiếm và sàng lọc ứng viên tiềm năng từ kho hồ sơ ứng tuyển
            chất lượng của SmartCV.
          </p>
        </div>
        <div className="rounded-full bg-ai/10 border border-ai/20 text-ai px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm animate-pulse">
          <Sparkles className="size-3.5" /> Gói Pro • Truy cập đầy đủ
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Filters Sidebar */}
        <aside className="card-surface p-5 space-y-5 rounded-2xl border border-border/50 shadow-sm sticky top-20">
          <div className="flex items-center justify-between border-b border-border/50 pb-2">
            <h3 className="font-bold text-foreground">Bộ lọc</h3>
            {(keyword || skill || experience || location) && (
              <button
                onClick={clearFilters}
                className="text-xs text-primary hover:underline font-semibold cursor-pointer"
              >
                Xóa tất cả
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Từ khóa / Tên
              </label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Nhập tên, chức danh..."
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Kỹ năng
              </label>
              <input
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="Ví dụ: Java, React, SQL..."
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Số năm kinh nghiệm
              </label>
              <input
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="Ví dụ: 3, 5..."
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Địa điểm
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ví dụ: Hanoi, Ho Chi Minh..."
                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </aside>

        {/* Candidate List */}
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Tìm thấy{" "}
            <span className="font-bold text-foreground">
              {filteredCandidates.length}
            </span>{" "}
            ứng viên phù hợp
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl bg-muted/30 border border-border/40 h-28"
                />
              ))}
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="card-surface p-12 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center">
              <X className="size-12 text-muted-foreground/60 mb-3" />
              <h3 className="font-semibold text-lg text-foreground">
                Không tìm thấy ứng viên
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                Thử thay đổi từ khóa hoặc bộ lọc để mở rộng phạm vi tìm kiếm.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedCandidates.map((c) => {
                  const isLocked = !unlockedIds.includes(c.id ?? "");
                  const displayName = isLocked
                    ? "Ứng viên ***"
                    : (c.fullName ?? "—");
                  const expDisplay =
                    c.yearsOfExperience != null
                      ? `${c.yearsOfExperience} năm`
                      : "Chưa rõ";

                  return (
                    <div
                      key={c.id}
                      className="card-surface p-5 rounded-2xl border border-border/50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-5 transition-all duration-300 hover:shadow-md"
                    >
                      {/* Avatar Area */}
                      <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-lg shrink-0 shadow-inner">
                        {isLocked ? (
                          <Lock className="size-5 text-primary/70 animate-pulse" />
                        ) : (
                          (c.fullName?.split(" ").pop()?.[0] ?? "?")
                        )}
                      </div>

                      {/* Profile Info */}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-lg text-foreground leading-tight">
                            {displayName}
                          </h3>
                          {isLocked && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                              <Lock className="size-2.5" /> Chưa mở khóa
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 items-center">
                          <span className="flex items-center gap-1">
                            <Briefcase className="size-3.5" /> {c.title ?? "—"}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5" />{" "}
                            {c.address ?? "Chưa rõ"}
                          </span>
                          <span>•</span>
                          <span>Kinh nghiệm: {expDisplay}</span>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {(c.skills ?? []).map((s) => (
                            <span
                              key={s}
                              className="text-xs bg-secondary text-secondary-foreground px-2.5 py-0.5 rounded-md font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleOpenModal(c)}
                          className="w-full"
                        >
                          Xem hồ sơ
                        </Button>
                        {isLocked ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnlock(c.id ?? "")}
                            className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          >
                            <Unlock className="size-3.5 mr-1" /> Mở khóa
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                          >
                            Mời ứng tuyển
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-border/60">
                  <div className="text-sm text-muted-foreground">
                    Hiển thị{" "}
                    <span className="font-semibold text-foreground">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                    </span>{" "}
                    -{" "}
                    <span className="font-semibold text-foreground">
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        filteredCandidates.length,
                      )}
                    </span>{" "}
                    trong tổng số{" "}
                    <span className="font-semibold text-foreground">
                      {filteredCandidates.length}
                    </span>{" "}
                    ứng viên
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 text-xs cursor-pointer"
                    >
                      Trang trước
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (p) => (
                        <Button
                          key={p}
                          variant={currentPage === p ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(p)}
                          className="size-8 p-0 text-xs cursor-pointer font-bold"
                        >
                          {p}
                        </Button>
                      ),
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="h-8 text-xs cursor-pointer"
                    >
                      Trang sau
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl rounded-2xl">
            {(() => {
              const isLocked = !unlockedIds.includes(
                selectedCandidate.id ?? "",
              );
              const displayName = isLocked
                ? "Ứng viên ***"
                : (selectedCandidate.fullName ?? "—");
              const expDisplay =
                selectedCandidate.yearsOfExperience != null
                  ? `${selectedCandidate.yearsOfExperience} năm`
                  : "Chưa rõ";

              return (
                <>
                  <DialogHeader>
                    <div className="flex items-center gap-4 border-b border-border/60 pb-4">
                      <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-2xl shadow-inner">
                        {isLocked ? (
                          <Lock className="size-6 text-primary/70" />
                        ) : (
                          (selectedCandidate.fullName?.split(" ").pop()?.[0] ??
                            "?")
                        )}
                      </div>
                      <div className="text-left space-y-1">
                        <DialogTitle className="text-2xl font-black flex items-center gap-2">
                          {displayName}
                          {isLocked && (
                            <span className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                              <Lock className="size-2.5" /> Chưa mở khóa
                            </span>
                          )}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground font-medium flex items-center gap-1">
                          <Briefcase className="size-3.5" />{" "}
                          {selectedCandidate.title ?? "—"}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4">
                    {/* Left Column: Basic Info */}
                    <div className="md:col-span-2 space-y-5">
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                          Thông tin chi tiết
                        </h4>
                        <div className="space-y-2 text-sm leading-relaxed">
                          <div className="flex items-center gap-2">
                            <MapPin className="size-4 text-muted-foreground" />
                            <strong>Địa điểm:</strong>{" "}
                            {selectedCandidate.address ?? "Chưa rõ"}
                          </div>
                          <div className="flex items-center gap-2">
                            <Briefcase className="size-4 text-muted-foreground" />
                            <strong>Kinh nghiệm:</strong> {expDisplay}
                          </div>
                        </div>
                      </div>

                      {/* Contact Info Card */}
                      <div className="rounded-xl p-4 bg-muted/30 border border-border/50 space-y-3.5">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                          <UserCheck className="size-3.5 text-primary" /> Thông
                          tin liên hệ
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="size-4 text-muted-foreground" />
                            <strong>Email:</strong>{" "}
                            {isLocked
                              ? "********@gmail.com"
                              : (selectedCandidate.email ?? "—")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="size-4 text-muted-foreground" />
                            <strong>Số điện thoại:</strong>{" "}
                            {isLocked
                              ? "09** *** ***"
                              : (selectedCandidate.phone ?? "—")}
                          </div>
                        </div>
                        {isLocked && (
                          <div className="pt-1.5 border-t border-border/60">
                            <Button
                              size="sm"
                              className="w-full gap-1.5 font-bold shadow-md bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() =>
                                handleUnlock(selectedCandidate.id ?? "")
                              }
                            >
                              <Unlock className="size-4" /> Mở khóa hồ sơ đầy
                              đủ
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Skills */}
                    <div className="space-y-5 border-t md:border-t-0 md:border-l border-border/60 pt-5 md:pt-0 md:pl-5">
                      <div className="space-y-2.5">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border pb-1">
                          Kỹ năng
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {(selectedCandidate.skills ?? []).map((s) => (
                            <span
                              key={s}
                              className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="border-t border-border/60 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Đóng
                    </Button>
                    {!isLocked && (
                      <Button
                        onClick={() => {
                          toast.success(
                            `Đã gửi thư mời ứng tuyển tới ứng viên ${selectedCandidate.fullName}`,
                          );
                          setIsModalOpen(false);
                        }}
                      >
                        Mời ứng tuyển
                      </Button>
                    )}
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
